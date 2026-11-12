using System.ComponentModel.DataAnnotations;

// Shapes of the data sent to API clients (distinct from database entities)
namespace LibraryService.Dtos;

/// <summary>
/// The game card the browser already shows: body of the favorites and wishlist PUT, and one
/// item of the wishlist import. The names match the frontend's Game object, so the frontend
/// sends it unchanged and library-service doesn't have to ask catalog-service (and so IGDB)
/// for the same data. Extra fields of the card (e.g. metacritic) are ignored when the body is read.
/// The text limits match the database columns (LibraryDbContext); ParentPlatforms is capped
/// because it is saved as JSON text in a 2000-character column.
/// </summary>
public record GameSnapshotDto(
    [Range(1, int.MaxValue)] int Id,
    [Required, MaxLength(300)] string Name,
    [MaxLength(500)] string? BackgroundImage,
    DateOnly? Released,
    [Range(0, 5)] double? Rating,
    [MaxLength(20)] List<PlatformEntryDto>? ParentPlatforms);
