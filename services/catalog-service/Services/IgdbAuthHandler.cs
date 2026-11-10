using System.Net;
using System.Net.Http.Headers;

namespace CatalogService.Services;

/// <summary>
/// Adds the two headers IGDB requires (Client-ID and Authorization: Bearer ...) to every
/// request of <see cref="IgdbClient"/>, so that IgdbClient never has to think about
/// authentication.
/// </summary>
/// <remarks>
/// It also handles one failure automatically: if IGDB answers 401 Unauthorized, the
/// token is thrown away, a fresh one is obtained and the request is sent once more.
/// </remarks>
public sealed class IgdbAuthHandler(IgdbTokenProvider tokens) : DelegatingHandler
{
    /// <summary>
    /// Called by HttpClient for every outgoing request. Adds the headers, forwards
    /// the request and retries once on 401.
    /// </summary>
    /// <param name="request">The request IgdbClient built.</param>
    /// <param name="ct">Cancellation token.</param>
    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken ct)
    {
        await AddAuthHeadersAsync(request, ct);
        var response = await base.SendAsync(request, ct);

        if (response.StatusCode != HttpStatusCode.Unauthorized)
            return response;

        // 401: the token is no longer accepted. Discard it, get a new one, try once more.
        response.Dispose();
        tokens.Invalidate();
        await AddAuthHeadersAsync(request, ct);
        return await base.SendAsync(request, ct);
    }

    /// <summary>Sets (or replaces) the Client-ID and Bearer token headers on the request.</summary>
    /// <param name="request">The request to modify.</param>
    /// <param name="ct">Cancellation token.</param>
    private async Task AddAuthHeadersAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var token = await tokens.GetTokenAsync(ct);

        request.Headers.Remove("Client-ID"); // avoid a duplicate header on the retry
        request.Headers.Add("Client-ID", tokens.ClientId);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }
}
