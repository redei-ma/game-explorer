// Shapes of the data sent to API clients (distinct from database entities)
namespace LibraryService.Dtos;

/// <summary>
/// What the API returns for a favorite. Deliberately leaves out ClientId and the
/// internal Id: the browser doesn't need them, and the client ID is a secret.
/// </summary>
public record FavoriteDto(int GameId, string Name, string? CoverUrl, double? Rating, DateOnly? ReleaseDate, DateTimeOffset AddedAt);
