// The JSON shapes the frontend reads. They follow RAWG's API, which the frontend was
// written for; IgdbClient fills them from IGDB data.
namespace CatalogService.Models;

/// <summary>
/// Answer of GET /api/games: the total number of matches plus the current page of games.
/// </summary>
/// <param name="Count">Total number of games matching the search (across all pages).</param>
/// <param name="Results">The games on the requested page.</param>
public record GameListResponse(int Count, List<GameSummary> Results);

/// <summary>
/// One game inside a list of results, with only the fields the game cards need.
/// </summary>
/// <param name="Id">IGDB game id (used later for the detail page).</param>
/// <param name="Name">Title of the game.</param>
/// <param name="Released">Release date as "yyyy-MM-dd", or null if unknown.</param>
/// <param name="Rating">Average user rating on a 0-5 scale; 0 when nobody rated it.</param>
/// <param name="BackgroundImage">URL of the cover image, or null if missing.</param>
/// <param name="ParentPlatforms">Platform groups (PC, PlayStation...), built by PlatformCatalog.</param>
/// <param name="Metacritic">Critic score (0-100), or null if the game has none.</param>
public record GameSummary(
    int                     Id,
    string                  Name,
    string?                 Released,
    double                  Rating,
    string?                 BackgroundImage,
    List<PlatformEntry>?    ParentPlatforms,
    int?                    Metacritic);

/// <summary>
/// Answer of GET /api/games/{id}: full details of one game.
/// </summary>
/// <param name="BackgroundImage">Wide artwork shown as the banner of the detail page, or null if missing.</param>
/// <param name="CoverImage">URL of the cover, built exactly like <see cref="GameSummary.BackgroundImage"/> in the list,
/// so the card of a game looks the same in the list, in favorites and in the wishlist. Null if missing.</param>
public record GameDetail(
    int                 Id,
    string              Name,
    string?             DescriptionRaw,        // plain-text description (IGDB "summary")
    string?             Released,
    double              Rating,
    int?                Metacritic,               // nullable: many games have no score
    string?             BackgroundImage,
    List<NamedItem>     Genres,
    List<NamedItem>     Developers,
    List<NamedItem>     Publishers,
    List<PlatformEntry> Platforms,
    List<PlatformEntry> ParentPlatforms,
    string?             CoverImage);

/// <summary>
/// A simple { id, name, slug } object for genres, developers, publishers and platforms.
/// </summary>
public record NamedItem(int Id, string Name, string? Slug);

/// <summary>Each platform is wrapped as { "platform": { id, name, slug } }, as RAWG did.</summary>
public record PlatformEntry(NamedItem Platform);

/// <summary>
/// One genre or platform for the filter dropdowns of the frontend.
/// </summary>
/// <param name="Id">IGDB id, sent back as a filter value.</param>
/// <param name="Name">Display name (e.g. "Action", "PlayStation 5").</param>
/// <param name="Slug">URL-friendly name (e.g. "action").</param>
/// <param name="GamesCount">Always null: IGDB does not give a count per genre or platform.</param>
/// <param name="Platforms">Child platforms (parent platforms only); null otherwise.</param>
public record CatalogItem(int Id, string Name, string Slug, int? GamesCount, List<NamedItem>? Platforms = null);

/// <summary>Answer of GET /api/genres, /api/parent-platforms and /api/platforms, all in one page.</summary>
/// <param name="Count">Total number of entries.</param>
/// <param name="Results">The entries.</param>
public record CatalogListResponse(int Count, List<CatalogItem> Results);

/// <summary>
/// Answer of GET /api/games/{id}/screenshots, all in one page.
/// </summary>
/// <param name="Count">Total number of screenshots.</param>
/// <param name="Results">The screenshots.</param>
public record GameListScreenshots(int Count, List<GameScreenshot> Results);

/// <summary>A single screenshot with its image URL and dimensions.</summary>
public record GameScreenshot(
    int     Id,
    string  Image,
    bool    Hidden,                    // always false: IGDB has no hidden screenshots
    int     Width,
    int     Height
);
