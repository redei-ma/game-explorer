using System.Net.Http.Json;
using System.Text.Json;
using System.Net;
using Microsoft.Extensions.Caching.Memory;
using CatalogService.Models;

// Namespace: same as the models, so both files can see each other without extra imports.
namespace CatalogService.Services;

/// <summary>
/// A "typed client": a class dedicated to talking to the RAWG API.
/// The rest of the application calls this class and never deals with URLs
/// or the API key directly. This keeps all RAWG-specific logic in one place.
/// </summary>
/// <remarks>
/// The HttpClient and IConfiguration parameters are supplied automatically by
/// ASP.NET Core (dependency injection), so you never create them yourself.
/// Games data are cached for 24 hours to avoid redundant RAWG calls.
/// </remarks>
public class RawgClient(HttpClient http, IConfiguration config, IMemoryCache cache)
{
    // Settings that tell the JSON deserializer how to read RAWG's responses.
    // RAWG writes names in snake_case (background_image), while C# uses
    // PascalCase (BackgroundImage); this setting maps between the two.
    // "static readonly" means it is created once and shared by all calls.
    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web)
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
        };

    // The RAWG API key, read once from configuration (user-secrets in development).
    // If it is missing we fail immediately with a clear message instead of
    // sending requests that RAWG would reject.
    private readonly string _key = config["Rawg:ApiKey"]
        ?? throw new InvalidOperationException("Rawg:ApiKey is missing.");

    /// <summary>
    /// Gets a page of games from RAWG. Every filter is optional, so the same method serves
    /// the home page (no filters, ordered by rating) and the search page (with a search text).
    /// </summary>
    /// <param name="search">Text to look for in game names, or null for no text filter.</param>
    /// <param name="ordering">RAWG sort field; a leading "-" means descending (e.g. "-rating").</param>
    /// <param name="dates">Release range as "yyyy-MM-dd,yyyy-MM-dd", or null for any date.</param>
    /// <param name="page">Page number, starting at 1.</param>
    /// <param name="pageSize">How many games per page.</param>
    /// <param name="ct">Cancels the request if the caller disconnects.</param>
    public Task<GameListResponse?> GetGamesAsync(
    string? search = null, string? ordering = null, string? dates = null,
    string? genres = null, string? parentPlatforms = null,
    int page = 1, int pageSize = 20, CancellationToken ct = default)
{
    var query = new List<string> { $"key={_key}", $"page={page}", $"page_size={pageSize}" };

    if (!string.IsNullOrWhiteSpace(search))
        query.Add($"search={Uri.EscapeDataString(search)}");
    if (!string.IsNullOrWhiteSpace(ordering))
        query.Add($"ordering={Uri.EscapeDataString(ordering)}");
    if (!string.IsNullOrWhiteSpace(dates))
        query.Add($"dates={Uri.EscapeDataString(dates)}");
    if (!string.IsNullOrWhiteSpace(genres))
        query.Add($"genres={Uri.EscapeDataString(genres)}");
    if (!string.IsNullOrWhiteSpace(parentPlatforms))
        query.Add($"parent_platforms={Uri.EscapeDataString(parentPlatforms)}");

    return http.GetFromJsonAsync<GameListResponse>(
        $"games?{string.Join('&', query)}", JsonOptions, ct);
}


    /// <summary>
    /// Fetches the full details of a single game from RAWG.
    /// </summary>
    /// <param name="id">The RAWG game id, taken from the list results.</param>
    /// <param name="ct">Cancels the request if the caller disconnects.</param>
    /// <returns>The game, or null if RAWG reports that it does not exist.</returns>
    public Task<GameDetail?> GetGameAsync(int id, CancellationToken ct = default)
    => GetOrNullAsync<GameDetail>($"games/{id}?key={_key}", ct);

    /// <summary>Fetches the screenshots of one game, or null if the game does not exist.</summary>
    /// <param name="id">The RAWG game id.</param>
    /// <param name="ct">Cancellation token.</param>
    public Task<GameListScreenshots?> GetScreenshotsAsync(int id, CancellationToken ct = default)
    => GetOrNullAsync<GameListScreenshots>($"games/{id}/screenshots?key={_key}", ct);

    /// <summary>
    /// Sends a GET request to RAWG and converts the JSON response into <typeparamref name="T"/>.
    /// Returns null on HTTP 404; throws HttpRequestException on any other failure.
    /// </summary>
    /// <typeparam name="T">The record type the JSON should be converted into.</typeparam>
    /// <param name="url">Path relative to the base address, including the API key.</param>
    /// <param name="ct">Cancels the request if the caller disconnects.</param>
    private async Task<T?> GetOrNullAsync<T>(string url, CancellationToken ct) where T : class
    {
        using var response = await http.GetAsync(url, ct);

        if (response.StatusCode == HttpStatusCode.NotFound)
            return null;

        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>(JsonOptions, ct);
    }

    /// <summary>Returns all genres, cached for 24 hours.</summary>
    /// <param name="ct">Cancellation token.</param>
    public Task<CatalogListResponse?> GetGenresAsync(CancellationToken ct = default)
        => GetCachedAsync("genres", $"genres?key={_key}", ct);

    /// <summary>Returns the main platform families (PC, PlayStation, Xbox...), cached for 24 hours.</summary>
    /// <param name="ct">Cancellation token.</param>
    public Task<CatalogListResponse?> GetPlatformsAsync(CancellationToken ct = default)
        => GetCachedAsync("parent-platforms", $"platforms/lists/parents?key={_key}&page_size=50", ct);

    /// <summary>
    /// Returns the cached value for <paramref name="cacheKey"/>; on a miss, calls RAWG once,
    /// stores the answer for 24 hours and returns it.
    /// </summary>
    /// <param name="cacheKey">Unique name under which the result is stored in memory.</param>
    /// <param name="url">RAWG path to call when the cache is empty.</param>
    /// <param name="ct">Cancellation token.</param>
    private Task<CatalogListResponse?> GetCachedAsync(string cacheKey, string url, CancellationToken ct)
        => cache.GetOrCreateAsync(cacheKey, entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24);
            return GetOrNullAsync<CatalogListResponse>(url, ct);
        });
};
