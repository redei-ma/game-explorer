using CatalogService.Services;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;

namespace CatalogService.Controllers;

/// <summary>
/// Public endpoints of the catalog service. Each action receives a request from the
/// frontend (or the gateway), asks RAWG through <see cref="RawgClient"/>, and returns the result.
/// </summary>
[ApiController]            // enables automatic 400 responses for invalid input
[Route("api/games")]       // base URL for every action in this class
public class GamesController(RawgClient rawg) : ControllerBase
{
    /// <summary>
    /// Returns a page of games. With no parameters it returns the first 20 games.
    /// Example for the home page: GET /api/games?ordering=-rating&amp;pageSize=12
    /// </summary>
    /// <param name="search">Optional text to look for in game names.</param>
    /// <param name="ordering">Optional sort field, e.g. "-rating" or "-released".</param>
    /// <param name="dates">Optional release range, "yyyy-MM-dd,yyyy-MM-dd".</param>
    /// <param name="page">Page number, starting at 1.</param>
    /// <param name="minMetacritic">Optional minimum Metacritic score (0-100).</param>
    /// <param name="maxMetacritic">Optional maximum Metacritic score (0-100).</param>
    /// <param name="year">Optional release year; converted to a full-year date range.</param>
    /// <param name="pageSize">Games per page (limited to 1-40).</param>
    /// <param name="ct">Cancels the call if the client disconnects.</param>
    [HttpGet]
    public async Task<IActionResult> GetGames(
    [FromQuery] string? search = null, [FromQuery] string? ordering = null,
    [FromQuery] string? dates = null, [FromQuery] string? genres = null,
    [FromQuery] string? parentPlatforms = null, [FromQuery] string? platforms = null,
    [FromQuery] int page = 1, [FromQuery, Range(0, 100)]
    int? minMetacritic = null, [FromQuery, Range(0, 100)] int? maxMetacritic = null,
    [FromQuery, Range(1970, 2100)] int? year = null,
    [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        // Page size capped at 40.
        pageSize = Math.Clamp(pageSize, 1, 40);
        page = Math.Max(page, 1);

        if (minMetacritic is not null && maxMetacritic is not null && minMetacritic > maxMetacritic)
            return BadRequest("minMetacritic cannot be greater than maxMetacritic.");

        if (year is not null && string.IsNullOrWhiteSpace(dates))
            dates = $"{year}-01-01,{year}-12-31";

        try
        {
            return Ok(await rawg.GetGamesAsync(
            search: search, ordering: ordering, dates: dates,
            genres: genres, parentPlatforms: parentPlatforms, platforms: platforms,
            minMetacritic: minMetacritic, maxMetacritic: maxMetacritic,
            page: page, pageSize: pageSize, ct: ct));
        }
        catch (HttpRequestException ex)
        {
            return Problem($"Upstream API error: {ex.StatusCode}", statusCode: 502);
        }
    }

    /// <summary>Returns the full details of one game. GET /api/games/3498
    /// Throws "400 bad request" error with id <= 0 </summary>
    /// <param name="id">The RAWG game id; must be 1 or greater.</param>
    /// <param name="ct">Cancellation token.</param>
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById([Range(1, int.MaxValue)] int id, CancellationToken ct = default)
    {
        try
        {
            var game = await rawg.GetGameAsync(id, ct);
            return game is null ? NotFound() : Ok(game);
        }
        catch (HttpRequestException ex)
        {
            return Problem($"Upstream API error: {ex.StatusCode}", statusCode: 502);
        }
    }

    /// <summary>Returns the screenshots of one game. GET /api/games/3498/screenshots</summary>
    /// <param name="id">The RAWG game id.</param>
    /// <param name="ct">Cancellation token.</param>
    [HttpGet("{id:int}/screenshots")]
    public async Task<IActionResult> GetScreenshots(int id, CancellationToken ct = default)
    {
        try
        {
            var shots = await rawg.GetScreenshotsAsync(id, ct);
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
    /// The ~/ prefix tells ASP.NET to ignore the controller’s api/games
    /// base route.
    /// // </remarks>
    [HttpGet("~/api/genres")]
    public async Task<IActionResult> GetGenres(CancellationToken ct = default)
    {
        try { return Ok(await rawg.GetGenresAsync(ct)); }
        catch (HttpRequestException ex)
        {
            return Problem($"Upstream API error: {ex.StatusCode}", statusCode: 502);
        }
    }

    /// <summary>Lists platform families for the first dropdown. GET /api/parent-platforms</summary>
    /// <param name="ct">Cancellation token.</param>
    [HttpGet("~/api/parent-platforms")]
    public async Task<IActionResult> GetParentPlatforms(CancellationToken ct = default)
    {
        try { return Ok(await rawg.GetParentPlatformsAsync(ct)); }
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
        try { return Ok(await rawg.GetPlatformsAsync(ct)); }
        catch (HttpRequestException ex)
        {
            return Problem($"Upstream API error: {ex.StatusCode}", statusCode: 502);
        }
    }
}
