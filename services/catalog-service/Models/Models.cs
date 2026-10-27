// Namespace: groups all code of this project under one name, which avoids
// naming clashes with other libraries. By convention it matches the project name.
namespace CatalogService.Models;

/// <summary>
/// Represents the response of RAWG's /games endpoint: the total number of
/// matches plus the current page of games.
/// </summary>
/// <param name="Count">Total number of games matching the search (across all pages).</param>
/// <param name="Results">The games on the requested page.</param>
public record GameListResponse(int Count, List<GameSummary> Results);

/// <summary>
/// Represents one game inside a list of results. It contains only the
/// fields the Gaming Explorer cards need, so other JSON fields are ignored.
/// </summary>
/// <param name="Id">RAWG's unique identifier (used later for the detail page).</param>
/// <param name="Name">Title of the game.</param>
/// <param name="Released">Release date as text, or null if unknown.</param>
/// <param name="Rating">Average user rating.</param>
/// <param name="BackgroundImage">URL of the cover image, or null if missing.</param>
public record GameSummary(
    int Id,
    string Name,
    string? Released,
    double Rating,
    string? BackgroundImage);


/// <summary>
/// Full details of one game, as returned by RAWG's /games/{id} endpoint.
/// Property names are matched to RAWG's snake_case JSON by the serializer options in RawgClient.
/// </summary>
public record GameDetail(
    int Id,
    string Name,
    string? DescriptionRaw,        // description_raw: plain-text description
    string? Released,
    double Rating,
    int? Metacritic,               // nullable: many games have no score
    string? BackgroundImage,
    List<NamedItem> Genres,
    List<NamedItem> Developers,
    List<NamedItem> Publishers,
    List<PlatformEntry> Platforms);

/// <summary>A simple { id, name } object. Reused for genres, developers and publishers.</summary>
public record NamedItem(int Id, string Name);

/// <summary>RAWG wraps each platform as { "platform": { id, name } }, so we model that wrapper.</summary>
public record PlatformEntry(NamedItem Platform);

/// <summary>
/// Paged list of screenshots, as returned by RAWG's /games/{id}/screenshots endpoint.
/// </summary>
/// <param name="Count">Total number of screenshots available.</param>
/// <param name="Next">URL of the next page, or null if this is the last page.</param>
/// <param name="Previous">URL of the previous page, or null on the first page.</param>
/// <param name="Results">The screenshots on this page.</param>
public record GameListScreenshots(int Count, string? Next, string? Previous, List<GameScreenshot> Results);

// <summary>A single screenshot with its image URL and dimensions.</summary>
public record GameScreenshot(
    int Id,
    string Image,
    bool Hidden,                    // Default: false. Sets image as hidden or visible.
    int Width,
    int Height
);
