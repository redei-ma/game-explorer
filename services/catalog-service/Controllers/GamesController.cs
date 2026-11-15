
using CatalogService.Services;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;

namespace CatalogService.Controllers;

/// <summary>
/// Public endpoints of the catalog service. Each action receives a request from the
/// frontend (or the gateway), asks IGDB through <see cref="IgdbClient"/>, and returns the result.
/// The URLs, parameters and JSON shapes are the same as in the RAWG version, so the frontend did not change.
/// </summary>
[ApiController]
[Route("api/games")]
public class GamesController(IgdbClient igdb) : ControllerBase
{

    /// <summary>
    /// Highest page a client may ask for.
    /// The Angular constant MAX_PAGE in games-list.ts has the same value,
    ///  change both together if needed.
    /// </summary>
    public const int MaxPage = 800;

    /// <summary>
    /// Returns a page of games. With no parameters it returns the 20 most popular games.
    /// Example for the home page: GET /api/games?ordering=-rating&amp;pageSize=12
    /// </summary>
    /// <param name="search">Optional words to look for in game names.</param>
    /// <param name="ordering">Optional sort: name, released, rating, metacritic, added, created, updated; "-" prefix = descending.</param>
    /// <param name="dates">Optional release range, "yyyy-MM-dd,yyyy-MM-dd".</param>
    /// <param name="genres">Optional comma-separated genre ids (from /api/genres).</param>
    /// <param name="parentPlatforms">Optional comma-separated platform group ids (from /api/parent-platforms).</param>
    /// <param name="platforms">Optional comma-separated platform ids (from /api/platforms).</param>
    /// <param name="page">Page number, 1 to <see cref="MaxPage"/>. Anything else answers 400.</param>
    /// <param name="minMetacritic">Optional minimum critic score (0-100). With IGDB this is the aggregated critic rating.</param>
    /// <param name="maxMetacritic">Optional maximum critic score (0-100).</param>
    /// <param name="year">Optional release year; converted to a full-year date range.</param>
    /// <param name="pageSize">Games per page (limited to 1-40).</param>
    /// <param name="ct">Cancels the call if the client disconnects.</param>
    [HttpGet]
    public async Task<IActionResult> GetGames(
    [FromQuery] string? search = null, [FromQuery] string? ordering = null,
    [FromQuery] string? dates = null, [FromQuery] string? genres = null,
    [FromQuery] string? parentPlatforms = null, [FromQuery] string? platforms = null,
    [FromQuery, Range(1, MaxPage)] int page = 1, [FromQuery, Range(0, 100)]
    int? minMetacritic = null, [FromQuery, Range(0, 100)] int? maxMetacritic = null,
    [FromQuery, Range(1970, 2100)] int? year = null,
    [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        pageSize = Math.Clamp(pageSize, 1, 40);

        if (minMetacritic is not null && maxMetacritic is not null && minMetacritic > maxMetacritic)
            return Problem("minMetacritic cannot be greater than maxMetacritic.", statusCode: StatusCodes.Status400BadRequest);

        if (year is not null && string.IsNullOrWhiteSpace(dates))
            dates = $"{year}-01-01,{year}-12-31";

        try
        {
            return Ok(await igdb.GetGamesAsync(
            search: search, ordering: ordering, dates: dates,
            genres: genres, parentPlatforms: parentPlatforms, platforms: platforms,
            minMetacritic: minMetacritic, maxMetacritic: maxMetacritic,
            page: page, pageSize: pageSize, ct: ct));
        }
        catch (ArgumentException ex)
        {
            // IgdbClient rejected a parameter (bad id list, bad date range, unknown ordering).
            return Problem(ex.Message, statusCode: StatusCodes.Status400BadRequest);
        }
        catch (HttpRequestException ex)
        {
            return Problem($"Upstream API error: {ex.StatusCode}", statusCode: 502);
        }
    }

    /// <summary>Returns the full details of one game. GET /api/games/1942
    /// Answers 400 when id is less than 1.</summary>
    /// <param name="id">The IGDB game id; must be 1 or greater.</param>
    /// <param name="ct">Cancellation token.</param>
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById([Range(1, int.MaxValue)] int id, CancellationToken ct = default)
    {
        try
        {
            var game = await igdb.GetGameAsync(id, ct);
            return game is null ? NotFound() : Ok(game);
        }
        catch (HttpRequestException ex)
        {
            return Problem($"Upstream API error: {ex.StatusCode}", statusCode: 502);
        }
    }

    /// <summary>Returns the screenshots of one game. GET /api/games/1942/screenshots</summary>
    /// <param name="id">The IGDB game id; must be 1 or greater.</param>
    /// <param name="ct">Cancellation token.</param>
    [HttpGet("{id:int}/screenshots")]
    public async Task<IActionResult> GetScreenshots([Range(1, int.MaxValue)] int id, CancellationToken ct = default)
    {
        try
        {
            var shots = await igdb.GetScreenshotsAsync(id, ct);
            return shots is null ? NotFound() : Ok(shots);
        }
        catch (HttpRequestException ex)
        {
            return Problem($"Upstream API error: {ex.StatusCode}", statusCode: 502);
        }
    }

    /// <summary>Lists all genres for the filter dropdown. GET /api/genres</summary>
    /// <param name="ct">Cancellation token.</param>
    /// <remarks>
    /// The ~/ prefix tells ASP.NET to ignore the controller's api/games
    /// base route.
    /// </remarks>
    [HttpGet("~/api/genres")]
    public async Task<IActionResult> GetGenres(CancellationToken ct = default)
    {
        try { return Ok(await igdb.GetGenresAsync(ct)); }
        catch (HttpRequestException ex)
        {
            return Problem($"Upstream API error: {ex.StatusCode}", statusCode: 502);
        }
    }

    /// <summary>Lists platform groups (PC, PlayStation, Xbox...) for the first dropdown. GET /api/parent-platforms</summary>
    /// <param name="ct">Cancellation token.</param>
    [HttpGet("~/api/parent-platforms")]
    public async Task<IActionResult> GetParentPlatforms(CancellationToken ct = default)
    {
        try { return Ok(await igdb.GetParentPlatformsAsync(ct)); }
        catch (HttpRequestException ex)
        {
            return Problem($"Upstream API error: {ex.StatusCode}", statusCode: 502);
        }
    }

    /// <summary>Lists specific platforms. GET /api/platforms</summary>
    /// <param name="ct">Cancellation token.</param>
    [HttpGet("~/api/platforms")]
    public async Task<IActionResult> GetPlatforms(CancellationToken ct = default)
    {
        try { return Ok(await igdb.GetPlatformsAsync(ct)); }
        catch (HttpRequestException ex)
        {
            return Problem($"Upstream API error: {ex.StatusCode}", statusCode: 502);
        }
    }
}
