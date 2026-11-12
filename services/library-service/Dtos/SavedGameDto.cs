// Shapes of the data sent to API clients (distinct from database entities)
namespace LibraryService.Dtos;

/// <summary>
/// What the API returns for a game saved in a list (favorites or wishlist).
/// </summary>
public record SavedGameDto(
    int GameId,
    string Name,
    string? CoverUrl,
    double? Rating,
    DateOnly? ReleaseDate,
    List<PlatformEntryDto> ParentPlatforms,
    DateTimeOffset AddedAt);
