namespace LibraryService.Models;

/// <summary>
/// What the API sends to the browser for one favorite. It is separate from
/// <see cref="FavoriteGame"/> so the database shape can change without breaking
/// the frontend, and so ClientId is never sent back.
/// </summary>
/// <param name="GameId">RAWG's ID of the game.</param>
/// <param name="Name">Title of the game.</param>
/// <param name="CoverUrl">Cover image URL, or null.</param>
/// <param name="Rating">Average user rating.</param>
/// <param name="ReleaseDate">Release date, or null.</param>
/// <param name="AddedAtUtc">When it was added to the favorites.</param>
public record FavoriteDto(
    int GameId,
    string Name,
    string? CoverUrl,
    double Rating,
    DateOnly? ReleaseDate,
    DateTime AddedAtUtc);
