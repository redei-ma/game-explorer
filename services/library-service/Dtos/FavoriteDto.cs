// Shapes of the data sent to API clients (distinct from database entities)
namespace LibraryService.Dtos;

/// <summary>
/// What the API returns for a favorite.
/// </summary>
public record FavoriteDto(
    int GameId,
    string Name,
    string? CoverUrl,
    double? Rating,
    DateOnly? ReleaseDate,
    List<PlatformEntryDto> ParentPlatforms,
    DateTimeOffset AddedAt);
