using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace CatalogService.Services;

/// <summary>
/// Obtains and remembers the access token that IGDB requires on every request.
/// IGDB does not use a simple API key like RAWG: it uses a Twitch "app access token",
/// obtained by sending your Client ID and Client Secret to Twitch's login server
/// (the OAuth "client credentials" flow). The token lasts about 60 days, so we ask
/// for it once, keep it in memory and only ask again shortly before it expires.
/// </summary>
/// <remarks>
/// Registered as a singleton (one instance for the whole application), so every
/// request shares the same cached token instead of logging in to Twitch each time.
/// </remarks>
public sealed class IgdbTokenProvider(
    IHttpClientFactory httpFactory,
    IOptions<IgdbOptions> options,
    ILogger<IgdbTokenProvider> logger)
{
    /// <summary>Name of the HttpClient (configured in Program.cs) that points to Twitch's login server.</summary>
    public const string HttpClientName = "twitch-auth";

    // We renew the token this long before its real expiry, so a request never
    // leaves with a token that dies while travelling to IGDB.
    private static readonly TimeSpan RefreshMargin = TimeSpan.FromMinutes(5);

    // Only one thread at a time may ask Twitch for a new token. Without this, 20
    // simultaneous requests at startup would produce 20 separate logins.
    private readonly SemaphoreSlim _lock = new(1, 1);

    // The current token together with its expiry time, kept in ONE object so that
    // a reader can never see a new token paired with an old expiry (or vice versa).
    // "volatile" makes every thread always read the latest value.
    private volatile CachedToken? _current;

    /// <summary>
    /// Your Twitch application's Client ID. IGDB wants it in a "Client-ID" header
    /// on every request, so <see cref="IgdbAuthHandler"/> reads it from here.
    /// </summary>
    public string ClientId { get; } = options.Value.ClientId;

    // The secret is only ever sent to Twitch, never to IGDB, and never leaves this class.
    private readonly string _clientSecret = options.Value.ClientSecret;

    /// <summary>
    /// Returns a valid access token, logging in to Twitch only when the cached one
    /// is missing or about to expire.
    /// </summary>
    /// <param name="ct">Cancels the wait or the login request if the caller disconnects.</param>
    /// <returns>The token string to put after "Bearer " in the Authorization header.</returns>
    public async Task<string> GetTokenAsync(CancellationToken ct = default)
    {
        // Fast path: almost every call ends here, with no locking at all.
        if (IsUsable(_current))
            return _current!.Value;

        await _lock.WaitAsync(ct);
        try
        {
            // Check again: another thread may have refreshed the token while we waited for the lock.
            if (IsUsable(_current))
                return _current!.Value;

            var http = httpFactory.CreateClient(HttpClientName);

            // The credentials go in the request BODY (form-encoded), not in the URL,
            // so they never show up in logs that print request URLs.
            using var form = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = ClientId,
                ["client_secret"] = _clientSecret,
                ["grant_type"] = "client_credentials"
            });

            using var response = await http.PostAsync("oauth2/token", form, ct);
            response.EnsureSuccessStatusCode(); // a wrong ID/secret gives 400 or 403 here

            var body = await response.Content.ReadFromJsonAsync<TwitchTokenResponse>(ct)
                ?? throw new InvalidOperationException("Twitch returned an empty token response.");

            _current = new CachedToken(body.AccessToken, DateTimeOffset.UtcNow.AddSeconds(body.ExpiresIn));
            logger.LogInformation("Obtained new IGDB access token, valid until {Expiry:u}.", _current.ExpiresAt);
            return _current.Value;
        }
        finally
        {
            // Always release the lock, even if Twitch failed, or every later request would wait forever.
            _lock.Release();
        }
    }

    /// <summary>
    /// Throws away the cached token so the next <see cref="GetTokenAsync"/> logs in again.
    /// Called when IGDB answers 401 Unauthorized (for example, the token was revoked early).
    /// </summary>
    public void Invalidate() => _current = null;

    /// <summary>True if the token exists and is not inside the refresh margin.</summary>
    /// <param name="token">The cached token to check, possibly null.</param>
    private static bool IsUsable(CachedToken? token)
        => token is not null && DateTimeOffset.UtcNow < token.ExpiresAt - RefreshMargin;

    /// <summary>A token string paired with the moment it stops working.</summary>
    /// <param name="Value">The access token.</param>
    /// <param name="ExpiresAt">When Twitch says it expires.</param>
    private sealed record CachedToken(string Value, DateTimeOffset ExpiresAt);

    /// <summary>
    /// The shape of Twitch's JSON answer, e.g.
    /// { "access_token": "abc...", "expires_in": 5184000, "token_type": "bearer" }.
    /// JsonPropertyName maps Twitch's snake_case names onto C# property names.
    /// </summary>
    /// <param name="AccessToken">The token itself.</param>
    /// <param name="ExpiresIn">Lifetime in seconds.</param>
    private sealed record TwitchTokenResponse(
        [property: JsonPropertyName("access_token")] string AccessToken,
        [property: JsonPropertyName("expires_in")] int ExpiresIn);
}
