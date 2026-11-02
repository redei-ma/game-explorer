using System.Net.Http.Json;
using System.Text.Json;
using System.Net;
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
/// </remarks>
public class RawgClient(HttpClient http, IConfiguration config)
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
    /// Searches RAWG for games whose name matches the given text.
    /// </summary>
    /// <param name="search">Full or partial game name typed by the user.</param>
    /// <param name="page">Page number of results (starts at 1).</param>
    /// <param name="ct">Cancels the request if the caller disconnects.</param>
    /// <returns>The matching games, or null if RAWG returned an empty body.</returns>
    /// <exception cref="HttpRequestException">
    /// Thrown when RAWG answers with an error status code (e.g. 401, 429, 500).
    /// </exception>
    public Task<GameListResponse?> SearchGamesAsync(
        string search, int page = 1, CancellationToken ct = default)
    {
        // Build the relative URL (the base address is set in Program.cs).
        // EscapeDataString makes user text safe, e.g. "mario & luigi" would
        // otherwise break the query string.
        var url = $"games?key={_key}" +
                  $"&search={Uri.EscapeDataString(search)}" +
                  $"&page={page}&page_size=20";

        // Sends a GET request and converts the JSON response into C# objects.
        return http.GetFromJsonAsync<GameListResponse>(url, JsonOptions, ct);
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
};
