using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using CatalogService.Models;
using Microsoft.Extensions.Caching.Memory;

namespace CatalogService.Services;

/// <summary>
/// The typed client for IGDB, and the only class that writes IGDB queries (the base
/// URL is set in Program.cs). It translates the frontend's RAWG-style parameters into
/// IGDB queries and translates IGDB's answers back into the models of Models.cs.
/// </summary>
/// <remarks>
/// IGDB does not read filters from the URL. Every request is a POST whose body is a
/// small text query in IGDB's language, called Apicalypse, for example:
/// <code>
/// fields name, cover.image_id, first_release_date;
/// where genres = (12) &amp; platforms = (48);
/// sort rating desc;
/// limit 20; offset 40;
/// </code>
/// "cover.image_id" means "follow the cover reference and give me its image_id field":
/// this is called expansion, and it saves extra calls.
/// Authentication headers are added by <see cref="IgdbAuthHandler"/>, not here.
/// </remarks>
public class IgdbClient(HttpClient http, IMemoryCache cache, ILogger<IgdbClient> logger)
{
    // IGDB uses snake_case names (first_release_date); C# uses PascalCase (FirstReleaseDate).
    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web) { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };

    // Base address of IGDB's image server. The full URL is .../t_{size}/{image_id}.jpg.
    private const string ImageBaseUrl = "https://images.igdb.com/igdb/image/upload";

    // Keeps only "real" games: main games (0), standalone expansions (4), remakes (8),
    // remasters (9) and expanded games (10). Without it, searches fill up with DLCs,
    // bundles, mods and episodes. version_parent = null drops "Deluxe Edition" duplicates.
    // If IGDB ever rejects this line, its error message will name the field: edit or remove it here.
    private const string MainGamesFilter = "game_type = (0,4,8,9,10) & version_parent = null";

    // When sorting by user rating, ignore games rated by fewer people than this.
    // Otherwise the top of the list is games with a single 100/100 vote.
    private const int MinRatingVotes = 10;

    // Fields needed to build a GameSummary (one card).
    private const string SummaryFields =
        "fields name, first_release_date, rating, aggregated_rating, cover.image_id, platforms.id;";

    // Maps the frontend's RAWG ordering names onto IGDB field names.
    private static readonly Dictionary<string, string> SortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        ["name"]       = "name",
        ["released"]   = "first_release_date",
        ["rating"]     = "rating",
        ["metacritic"] = "aggregated_rating",   // critic score: our Metacritic substitute
        ["added"]      = "total_rating_count",  // closest thing to "popularity"
        ["created"]    = "created_at",
        ["updated"]    = "updated_at",
    };

    // ---------------------------------------------------------------- public API

    /// <summary>
    /// Gets a page of games. Every filter is optional.
    /// </summary>
    /// <param name="search">Words to look for in the name. Every word must appear (in any position).</param>
    /// <param name="ordering">RAWG-style sort, e.g. "-rating" (a leading "-" means descending).</param>
    /// <param name="dates">Release range "yyyy-MM-dd,yyyy-MM-dd".</param>
    /// <param name="genres">Comma-separated IGDB genre ids.</param>
    /// <param name="parentPlatforms">Comma-separated group ids from /api/parent-platforms.</param>
    /// <param name="platforms">Comma-separated IGDB platform ids.</param>
    /// <param name="minMetacritic">Minimum critic score, 0-100.</param>
    /// <param name="maxMetacritic">Maximum critic score, 0-100.</param>
    /// <param name="page">Page number, starting at 1.</param>
    /// <param name="pageSize">Games per page.</param>
    /// <param name="ct">Cancels the request if the caller disconnects.</param>
    /// <exception cref="ArgumentException">A parameter has an invalid format (the controller answers 400).</exception>
    public async Task<GameListResponse> GetGamesAsync(
        string? search = null, string? ordering = null, string? dates = null,
        string? genres = null, string? parentPlatforms = null, string? platforms = null,
        int? minMetacritic = null, int? maxMetacritic = null,
        int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        // 1. Build the "where" conditions. They are joined with "&" (AND) at the end.
        var where = new List<string> { MainGamesFilter };

        foreach (var word in SplitSearchWords(search))
            where.Add($"name ~ *\"{word}\"*");  // ~ = case-insensitive, *"x"* = "contains x"

        if (!string.IsNullOrWhiteSpace(dates))
        {
            var (from, toExclusive) = ParseDateRange(dates);
            where.Add($"first_release_date >= {from} & first_release_date < {toExclusive}");
        }

        if (!string.IsNullOrWhiteSpace(genres))
            where.Add($"genres = ({string.Join(',', ParseIds(genres, nameof(genres)))})"); // (a,b) = "has any of"

        if (!string.IsNullOrWhiteSpace(platforms))
            where.Add($"platforms = ({string.Join(',', ParseIds(platforms, nameof(platforms)))})");

        // Loaded after the checks above, so a bad date range or id list gets its 400
        // without waiting for IGDB, even when IGDB is down.
        var catalog = await GetPlatformCatalogAsync(ct);

        if (!string.IsNullOrWhiteSpace(parentPlatforms))
        {
            // A group is not an IGDB concept: expand it into its platform ids.
            var ids = ParseIds(parentPlatforms, nameof(parentPlatforms))
                .SelectMany(groupId => catalog.PlatformIdsOf(groupId))
                .Distinct();
            where.Add($"platforms = ({string.Join(',', ids)})");
        }

        if (minMetacritic is not null)
            where.Add($"aggregated_rating >= {minMetacritic}");
        if (maxMetacritic is not null)
            where.Add($"aggregated_rating <= {maxMetacritic}");

        // 2. Sorting. It may add one more condition (to skip games without that value).
        var sort = BuildSort(ordering, where);

        var whereClause = $"where {string.Join(" & ", where)};";

        // 3. Two requests, sent at the same time: the page of games, and the total count
        //    (IGDB gives the total only through a separate "/count" call).
        var gamesTask = QueryAsync<List<IgdbGame>>("games",
            $"{SummaryFields} {whereClause} {sort} limit {pageSize}; offset {(page - 1) * pageSize};", ct);
        var countTask = QueryAsync<IgdbCount>("games/count", whereClause, ct);
        await Task.WhenAll(gamesTask, countTask);

        // 4. Convert to the model the frontend understands.
        var results = gamesTask.Result.Select(g => ToSummary(g, catalog)).ToList();
        return new GameListResponse(countTask.Result.Count, results);
    }

    /// <summary>Fetches the full details of one game.</summary>
    /// <param name="id">IGDB game id.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The game, or null if IGDB has no game with this id (the controller answers 404).</returns>
    public async Task<GameDetail?> GetGameAsync(int id, CancellationToken ct = default)
    {
        const string fields =
            "fields name, slug, summary, first_release_date, rating, aggregated_rating, " +
            "cover.image_id, artworks.image_id, genres.name, genres.slug, " +
            "platforms.name, platforms.slug, " +
            "involved_companies.developer, involved_companies.publisher, " +
            "involved_companies.company.name, involved_companies.company.slug;";

        // IGDB always answers with an array; an empty array means "not found".
        var games = await QueryAsync<List<IgdbGame>>("games", $"{fields} where id = {id};", ct);
        var g = games.FirstOrDefault();
        if (g is null)
            return null;

        var catalog = await GetPlatformCatalogAsync(ct);

        var companies = g.InvolvedCompanies ?? [];
        return new GameDetail(
            Id:              g.Id,
            Name:            g.Name,
            DescriptionRaw:  g.Summary,
            Released:        ToDateString(g.FirstReleaseDate),
            Rating:          ToFiveStars(g.Rating),
            Metacritic:      ToScore(g.AggregatedRating),
            // Wide artwork looks best as a page background; fall back to the cover.
            BackgroundImage: ImageUrl(g.Artworks?.FirstOrDefault(), "1080p") ?? ImageUrl(g.Cover, "cover_big"),
            Genres:          (g.Genres ?? []).Select(ToNamedItem).ToList(),
            Developers:      companies.Where(c => c.Developer && c.Company is not null)
                                      .Select(c => ToNamedItem(c.Company!)).ToList(),
            Publishers:      companies.Where(c => c.Publisher && c.Company is not null)
                                      .Select(c => ToNamedItem(c.Company!)).ToList(),
            Platforms:       (g.Platforms ?? []).Select(p => new PlatformEntry(ToNamedItem(p))).ToList(),
            ParentPlatforms: ToParentPlatforms(g, catalog),
            CoverImage:      CardImage(g));
    }

    /// <summary>Fetches the screenshots of one game.</summary>
    /// <param name="id">IGDB game id.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The screenshots (possibly zero), or null if the game does not exist.</returns>
    public async Task<GameListScreenshots?> GetScreenshotsAsync(int id, CancellationToken ct = default)
    {
        var games = await QueryAsync<List<IgdbGame>>("games",
            $"fields screenshots.image_id, screenshots.width, screenshots.height; where id = {id};", ct);
        var g = games.FirstOrDefault();
        if (g is null)
            return null;

        var shots = (g.Screenshots ?? [])
            .Select(s => new GameScreenshot(
                Id:     s.Id,
                Image:  ImageUrl(s, "screenshot_huge")!,   // 1280x720
                Hidden: false,                              // IGDB has no hidden screenshots
                Width:  s.Width ?? 0,
                Height: s.Height ?? 0))
            .ToList();

        return new GameListScreenshots(shots.Count, shots);
    }

    /// <summary>Returns all genres, cached for 24 hours.</summary>
    /// <param name="ct">Cancellation token.</param>
    public async Task<CatalogListResponse> GetGenresAsync(CancellationToken ct = default)
    {
        var genres = await cache.GetOrCreateAsync("igdb-genres", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24);
            return await QueryAsync<List<IgdbNamed>>("genres", "fields name, slug; sort name asc; limit 500;", ct);
        }) ?? [];

        var items = genres.Select(g => new CatalogItem(g.Id, g.Name, g.Slug ?? "", GamesCount: null)).ToList();
        return new CatalogListResponse(items.Count, items);
    }

    /// <summary>Returns the platform groups (PC, PlayStation, Xbox...) with their platforms inside.</summary>
    /// <param name="ct">Cancellation token.</param>
    public async Task<CatalogListResponse> GetParentPlatformsAsync(CancellationToken ct = default)
    {
        var catalog = await GetPlatformCatalogAsync(ct);
        return new CatalogListResponse(catalog.Groups.Count, catalog.Groups.ToList());
    }

    /// <summary>Returns the specific platforms (PS5, Xbox One...) that belong to a group.</summary>
    /// <param name="ct">Cancellation token.</param>
    public async Task<CatalogListResponse> GetPlatformsAsync(CancellationToken ct = default)
    {
        var catalog = await GetPlatformCatalogAsync(ct);
        return new CatalogListResponse(catalog.Platforms.Count, catalog.Platforms.ToList());
    }

    // ---------------------------------------------------------------- low-level request

    /// <summary>
    /// Sends an Apicalypse query to one IGDB endpoint and converts the JSON answer into <typeparamref name="T"/>.
    /// If IGDB answers 429 (too many requests: the limit is 4 per second) it waits one second and retries once.
    /// </summary>
    /// <typeparam name="T">The type to read the answer into (a List for normal endpoints, IgdbCount for "/count").</typeparam>
    /// <param name="endpoint">The IGDB resource, e.g. "games", "games/count", "genres".</param>
    /// <param name="query">The Apicalypse text sent as the request body.</param>
    /// <param name="ct">Cancels the request if the caller disconnects.</param>
    /// <exception cref="HttpRequestException">
    /// IGDB returned an error. The message includes IGDB's explanation: for a 400 it says which part of the query is wrong.
    /// </exception>
    private async Task<T> QueryAsync<T>(string endpoint, string query, CancellationToken ct)
    {
        for (var attempt = 1; ; attempt++)
        {
            using var content = new StringContent(query, Encoding.UTF8, "text/plain");
            using var response = await http.PostAsync(endpoint, content, ct);

            if (response.StatusCode == HttpStatusCode.TooManyRequests && attempt == 1)
            {
                logger.LogWarning("IGDB {Endpoint} answered 429 (rate limit), retrying in 1 second.", endpoint);
                await Task.Delay(TimeSpan.FromSeconds(1), ct);
                continue; // second and last try
            }

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(ct);
                throw new HttpRequestException(
                    $"IGDB {endpoint} failed with {(int)response.StatusCode}: {error}",
                    inner: null,
                    statusCode: response.StatusCode);
            }

            return await response.Content.ReadFromJsonAsync<T>(JsonOptions, ct)
                ?? throw new InvalidOperationException($"IGDB {endpoint} returned an empty body.");
        }
    }

    /// <summary>
    /// Returns the platform groups and lookup tables, downloading IGDB's platform list
    /// at most once every 24 hours. Used by the dropdowns AND by every game list (for the card icons).
    /// </summary>
    /// <param name="ct">Cancellation token.</param>
    private async Task<PlatformCatalog> GetPlatformCatalogAsync(CancellationToken ct)
        => (await cache.GetOrCreateAsync("igdb-platform-catalog", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24);
            var all = await QueryAsync<List<IgdbPlatform>>("platforms",
                "fields name, slug, platform_family.name, platform_family.slug; limit 500;", ct);
            return PlatformCatalog.Build(all);
        }))!;

    // ---------------------------------------------------------------- translation helpers

    /// <summary>
    /// Turns RAWG's ordering ("-rating") into an Apicalypse sort line ("sort rating desc;").
    /// With no ordering, sorts by popularity, so the most-rated games come first.
    /// </summary>
    /// <param name="ordering">RAWG-style ordering, or null.</param>
    /// <param name="where">The condition list; a "value must exist" condition may be added to it.</param>
    /// <exception cref="ArgumentException">Unknown ordering name.</exception>
    private static string BuildSort(string? ordering, List<string> where)
    {
        if (string.IsNullOrWhiteSpace(ordering))
            return "sort total_rating_count desc;";

        var descending = ordering.StartsWith('-');
        var key = ordering.TrimStart('-');

        if (!SortFields.TryGetValue(key, out var field))
            throw new ArgumentException(
                $"Unknown ordering '{ordering}'. Allowed: {string.Join(", ", SortFields.Keys)} (prefix '-' for descending).");

        // Games with no value for the sort field would otherwise mix into the results.
        if (field == "rating")
            where.Add($"rating_count >= {MinRatingVotes}");
        else if (field is "aggregated_rating" or "first_release_date")
            where.Add($"{field} != null");

        return $"sort {field} {(descending ? "desc" : "asc")};";
    }

    /// <summary>
    /// Splits the search text into words and removes characters that could break the query.
    /// </summary>
    /// <remarks>
    /// SECURITY: the text goes INSIDE a query string ("..."). Without removing quotes, a user
    /// could type <c>x"; where id = 1</c> and change our query. That is the same idea as SQL injection.
    /// </remarks>
    /// <param name="search">Raw text from the user.</param>
    private static IEnumerable<string> SplitSearchWords(string? search)
        => (search ?? "")
            .Replace("\"", " ").Replace("\\", " ")
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Take(6); // a sensible limit; longer texts add nothing

    /// <summary>
    /// Parses "12,5,31" into numbers. Only digits are accepted, so nothing else can reach the query.
    /// </summary>
    /// <param name="csv">Comma-separated ids.</param>
    /// <param name="paramName">Parameter name, used in the error message.</param>
    /// <exception cref="ArgumentException">A value is not a positive whole number, or the list is empty.</exception>
    private static List<int> ParseIds(string csv, string paramName)
    {
        var ids = csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
              .Select(s => int.TryParse(s, NumberStyles.None, CultureInfo.InvariantCulture, out var n) && n > 0
                  ? n
                  : throw new ArgumentException($"'{s}' in {paramName} is not a valid id."))
              .ToList();

        return ids.Count > 0 ? ids : throw new ArgumentException($"{paramName} has no ids.");
    }

    /// <summary>
    /// Converts "2020-01-01,2020-12-31" into two Unix timestamps: the start, and the
    /// midnight AFTER the end date (so the whole last day is included).
    /// </summary>
    /// <param name="dates">Range in RAWG format.</param>
    /// <exception cref="ArgumentException">Wrong format.</exception>
    private static (long From, long ToExclusive) ParseDateRange(string dates)
    {
        var parts = dates.Split(',', StringSplitOptions.TrimEntries);
        if (parts.Length != 2
            || !DateOnly.TryParseExact(parts[0], "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var from)
            || !DateOnly.TryParseExact(parts[1], "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var to)
            || from > to)
            throw new ArgumentException("dates must be 'yyyy-MM-dd,yyyy-MM-dd' with the first date not after the second.");

        static long Unix(DateOnly d) => new DateTimeOffset(d.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero).ToUnixTimeSeconds();
        return (Unix(from), Unix(to.AddDays(1)));
    }

    /// <summary>
    /// The image a game card shows: the portrait box art. The list AND the details call this,
    /// so a game's card looks the same in the list, in favorites and in the wishlist.
    /// </summary>
    /// <param name="g">Raw IGDB game (needs cover.image_id).</param>
    private static string? CardImage(IgdbGame g) => ImageUrl(g.Cover, "cover_big");  // 264x374

    /// <summary>
    /// Turns the game's specific platforms (PS4, PS5...) into its groups (PlayStation), one per group.
    /// The list AND the details call this, so the icons on a card never depend on where the card came from.
    /// </summary>
    /// <param name="g">Raw IGDB game (needs platforms.id).</param>
    /// <param name="catalog">Used to find the group of each platform.</param>
    private static List<PlatformEntry> ToParentPlatforms(IgdbGame g, PlatformCatalog catalog)
        => (g.Platforms ?? [])
            .Select(p => catalog.GroupOf(p.Id))
            .OfType<NamedItem>()            // drops nulls (platforms with no group)
            .DistinctBy(group => group.Id)
            .Select(group => new PlatformEntry(group))
            .ToList();

    /// <summary>Converts one IGDB game into the card model the frontend expects.</summary>
    /// <param name="g">Raw IGDB game.</param>
    /// <param name="catalog">Used to turn platform ids into group icons.</param>
    private static GameSummary ToSummary(IgdbGame g, PlatformCatalog catalog)
        => new(
            Id:              g.Id,
            Name:            g.Name,
            Released:        ToDateString(g.FirstReleaseDate),
            Rating:          ToFiveStars(g.Rating),
            BackgroundImage: CardImage(g),  // portrait box art (264x374)
            ParentPlatforms: ToParentPlatforms(g, catalog),
            Metacritic:      ToScore(g.AggregatedRating));

    /// <summary>Unix timestamp -> "yyyy-MM-dd" (RAWG's format), or null if unknown.</summary>
    /// <param name="unix">Seconds since 1 Jan 1970 UTC.</param>
    private static string? ToDateString(long? unix)
        => unix is null ? null
            : DateTimeOffset.FromUnixTimeSeconds(unix.Value).UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    /// <summary>
    /// IGDB user rating (0-100) -> RAWG scale (0-5), so the frontend's stars keep working.
    /// Unrated games get 0, as they did on RAWG.
    /// </summary>
    /// <param name="rating0to100">IGDB rating or null.</param>
    private static double ToFiveStars(double? rating0to100)
        => rating0to100 is null ? 0 : Math.Round(rating0to100.Value / 20, 2);

    /// <summary>Critic rating (decimal, 0-100) -> whole number like a Metascore, or null.</summary>
    /// <param name="aggregated">IGDB aggregated_rating or null.</param>
    private static int? ToScore(double? aggregated)
        => aggregated is null ? null : (int)Math.Round(aggregated.Value);

    /// <summary>Builds an image URL from an IGDB image reference and a size name, or null.</summary>
    /// <param name="image">The image reference (may be null).</param>
    /// <param name="size">IGDB size name, e.g. "cover_big", "screenshot_huge", "1080p".</param>
    private static string? ImageUrl(IgdbImage? image, string size)
        => image is null ? null : $"{ImageBaseUrl}/t_{size}/{image.ImageId}.jpg";

    /// <summary>IGDB {id, name, slug} -> our NamedItem.</summary>
    /// <param name="n">IGDB object.</param>
    private static NamedItem ToNamedItem(IgdbNamed n) => new(n.Id, n.Name, n.Slug);
}
