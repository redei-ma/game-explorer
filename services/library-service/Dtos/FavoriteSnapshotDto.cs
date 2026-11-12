using System.ComponentModel.DataAnnotations;

// Shapes of the data sent to API clients (distinct from database entities)
namespace LibraryService.Dtos;

/// <summary>
/// Body of PUT /api/library/favorites/{gameId}: the game card the browser already shows.
/// The names match the frontend's Game object, so the frontend sends it unchanged and
/// library-service doesn't have to ask catalog-service (and so IGDB) for the same data.
/// Extra fields of the card (id, metacritic) are ignored when the body is read.
/// The text limits match the database columns (LibraryDbContext); ParentPlatforms is capped
/// because it is saved as JSON text in a 2000-character column.
/// </summary>
public record FavoriteSnapshotDto(
    [Required, MaxLength(300)] string Name,
    [MaxLength(500)] string? BackgroundImage,
    DateOnly? Released,
    [Range(0, 5)] double? Rating,
    [MaxLength(20)] List<PlatformEntryDto>? ParentPlatforms);
