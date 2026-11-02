using System.Net;

// Code that talks to other services over HTTP.
namespace LibraryService.Services;

/// <summary>
/// The part of a game that library-service needs from catalog-service.
/// Defined here on purpose instead of sharing catalog's class: services must
/// not depend on each other's code, only on the JSON contract.
/// Fields that don't appear here are ignored while reading the JSON.
/// </summary>
/// <param name="Id">RAWG's game ID.</param>
/// <param name="Name">Title of the game.</param>
/// <param name="Released">Release date as text (yyyy-MM-dd), or null.</param>
/// <param name="Rating">Average user rating.</param>
/// <param name="BackgroundImage">Cover image URL, or null.</param>
public record CatalogGame(int Id, string Name, string? Released, double Rating, string? BackgroundImage);

/// <summary>
/// Typed HTTP client for catalog-service. ASP.NET injects a ready-to-use
/// <see cref="HttpClient"/> whose address and timeout are set in Program.cs.
/// </summary>
public class CatalogClient(HttpClient http)
{
    /// <summary>
    /// Asks catalog-service for one game.
    /// </summary>
    /// <param name="gameId">RAWG's ID of the game.</param>
    /// <param name="ct">Cancels the call if the browser disconnects.</param>
    /// <returns>The game, or null if the catalog says it doesn't exist.</returns>
    /// <exception cref="HttpRequestException">The catalog failed or can't be reached.</exception>
    public async Task<CatalogGame?> GetGameAsync(int gameId, CancellationToken ct)
    {
        using var response = await http.GetAsync($"games/{gameId}", ct);

        if (response.StatusCode == HttpStatusCode.NotFound)
            return null;

        // Any other error status (500, 429...) becomes an exception.
        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<CatalogGame>(ct);
    }
}
