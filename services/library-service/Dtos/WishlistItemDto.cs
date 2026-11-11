// Shapes of the data sent to API clients (distinct from database entities)
namespace LibraryService.Dtos;

/// <summary>
/// What the API returns for a wishlist item. Leaves out the internal Id and the UserId:
/// the browser doesn't need them.
/// </summary>
public record WishlistItemDto(int GameId, string Name, string? CoverUrl, double? Rating, DateOnly? ReleaseDate, DateTimeOffset AddedAt);
