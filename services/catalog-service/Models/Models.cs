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
/// <param name="ParentPlatforms">Main platform families (PC, PlayStation...); maps to JSON "parent_platforms".</param>
public record GameSummary(
    int Id,
    string Name,
    string? Released,
    double Rating,
    string? BackgroundImage,
    List<PlatformEntry>? ParentPlatforms);


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

/// <summary>
/// A simple { id, name, slug } object returned by RAWG for genres, developers,
/// publishers and platforms. The slug is a stable, URL-friendly identifier.
/// </summary>
public record NamedItem(int Id, string Name, string? Slug);

/// <summary>RAWG wraps each platform as { "platform": { id, name } }, so we model that wrapper.</summary>
public record PlatformEntry(NamedItem Platform);

/// <summary>
/// One genre or platform as listed by RAWG's /genres and /platforms endpoints.
/// Used to fill the filter dropdowns in the frontend.
/// </summary>
/// <param name="Id">RAWG id, sent back as a filter value.</param>
/// <param name="Name">Display name (e.g. "Action", "PlayStation 5").</param>
/// <param name="Slug">URL-friendly name (e.g. "action"); also accepted as a filter value.</param>
/// <param name="GamesCount">How many games RAWG has for this entry.</param>
public record CatalogItem(int Id, string Name, string Slug, int? GamesCount);

/// <summary>Paged list of genres or platforms, as returned by RAWG.</summary>
/// <param name="Count">Total number of entries.</param>
/// <param name="Results">The entries on this page.</param>
public record CatalogListResponse(int Count, List<CatalogItem> Results);

/// <summary>
/// Paged list of screenshots, as returned by RAWG's /games/{id}/screenshots endpoint.
/// RAWG's "next" and "previous" links are deliberately omitted because they contain the API key and must never reach the browser.
/// </summary>
/// <param name="Count">Total number of screenshots available.</param>
/// <param name="Results">The screenshots on this page.</param>
public record GameListScreenshots(int Count, List<GameScreenshot> Results);

// <summary>A single screenshot with its image URL and dimensions.</summary>
public record GameScreenshot(
    int Id,
    string Image,
    bool Hidden,                    // Default: false. Sets image as hidden or visible.
    int Width,
    int Height
);
