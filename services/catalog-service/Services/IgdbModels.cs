// Namespace: these records describe IGDB's raw JSON, so they live next to IgdbClient
// (in Services), NOT in Models. Models holds what OUR API returns to the frontend;
// this file holds what IGDB returns to us. IgdbClient converts one into the other.
namespace CatalogService.Services;

/// <summary>
/// One game as IGDB returns it from the "games" endpoint. Every field is optional
/// (nullable) because IGDB only sends the fields we ask for in the "fields" line,
/// and omits any field that has no value for that game.
/// </summary>
/// <param name="Id">IGDB's game id. This is the id the frontend receives and sends back.</param>
/// <param name="Name">Title.</param>
/// <param name="Slug">URL-friendly name.</param>
/// <param name="Summary">Plain-text description (used for GameDetail.DescriptionRaw).</param>
/// <param name="FirstReleaseDate">Earliest release, as a Unix timestamp (seconds since 1 Jan 1970, UTC).</param>
/// <param name="Rating">Average IGDB USER rating, from 0 to 100.</param>
/// <param name="AggregatedRating">Average CRITIC rating from external sites, 0 to 100. Our Metacritic substitute.</param>
/// <param name="Cover">The box-art image.</param>
/// <param name="Artworks">Promotional wide images, used as the detail page background.</param>
/// <param name="Screenshots">In-game screenshots.</param>
/// <param name="Genres">Genres, expanded to id/name/slug.</param>
/// <param name="Platforms">Platforms, expanded to id/name/slug.</param>
/// <param name="InvolvedCompanies">Companies with their role (developer and/or publisher).</param>
public sealed record IgdbGame(
    int                         Id,
    string                      Name,
    string?                     Slug,
    string?                     Summary,
    long?                       FirstReleaseDate,
    double?                     Rating,
    double?                     AggregatedRating,
    IgdbImage?                  Cover,
    List<IgdbImage>?            Artworks,
    List<IgdbImage>?            Screenshots,
    List<IgdbNamed>?            Genres,
    List<IgdbNamed>?            Platforms,
    List<IgdbInvolvedCompany>?  InvolvedCompanies);

/// <summary>
/// An image reference (cover, artwork or screenshot). IGDB does not give a full URL:
/// it gives an image_id, and we build the URL ourselves, choosing the size we want.
/// </summary>
/// <param name="Id">Id of the image record.</param>
/// <param name="ImageId">The key used to build the URL, e.g. "co1wyy".</param>
/// <param name="Width">Original width in pixels.</param>
/// <param name="Height">Original height in pixels.</param>
public sealed record IgdbImage(int Id, string ImageId, int? Width, int? Height);

/// <summary>Any IGDB object reduced to id, name and slug (genres, companies, platform families...).</summary>
/// <param name="Id">IGDB id.</param>
/// <param name="Name">Display name.</param>
/// <param name="Slug">URL-friendly name.</param>
public sealed record IgdbNamed(int Id, string Name, string? Slug);

/// <summary>A platform as returned by the "platforms" endpoint, with its family (PlayStation, Xbox...).</summary>
/// <param name="Id">IGDB platform id (e.g. 167 = PlayStation 5).</param>
/// <param name="Name">Display name.</param>
/// <param name="Slug">URL-friendly name.</param>
/// <param name="PlatformFamily">The family it belongs to, or null (PC, Mac and iOS have none).</param>
public sealed record IgdbPlatform(int Id, string Name, string? Slug, IgdbNamed? PlatformFamily);

/// <summary>
/// Links a game to a company and says what the company did. IGDB has no separate
/// "developers" and "publishers" lists like RAWG; we split this list by the two flags.
/// </summary>
/// <param name="Company">The company.</param>
/// <param name="Developer">True if this company developed the game.</param>
/// <param name="Publisher">True if this company published the game.</param>
public sealed record IgdbInvolvedCompany(IgdbNamed? Company, bool Developer, bool Publisher);

/// <summary>The answer of a "/count" endpoint, e.g. { "count": 1234 }.</summary>
/// <param name="Count">How many records match the query.</param>
public sealed record IgdbCount(int Count);
