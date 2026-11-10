using System.Net;

namespace LibraryService.Services;

/// <summary>The part of catalog-service's game-detail response that library-service needs.</summary>
public record CatalogGame(int Id, string Name, DateOnly? Released, double? Rating, string? BackgroundImage);

/// <summary>Contract for asking catalog-service about games. An interface lets tests replace it with a fake.</summary>
public interface ICatalogClient
{
    /// <summary>Returns the game, or null if catalog-service says it doesn't exist.</summary>
    Task<CatalogGame?> GetGameAsync(int gameId, CancellationToken ct);
}

/// <summary>Calls catalog-service over HTTP.</summary>
public class CatalogClient(HttpClient http) : ICatalogClient
{
    /// <summary>
    /// Fetches one game. 404 becomes null; any other failure throws HttpRequestException,
    /// which the controller turns into a 502 response.
    /// </summary>
    public async Task<CatalogGame?> GetGameAsync(int gameId, CancellationToken ct)
    {
        // Called directly, not through the gateway; the path still starts with api/
        // because catalog's routes match the URLs the gateway forwards unchanged
        using var response = await http.GetAsync($"api/games/{gameId}", ct);

        if (response.StatusCode == HttpStatusCode.NotFound)
            return null;

        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<CatalogGame>(ct);
    }
}
