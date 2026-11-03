
using CatalogService.Services;
using Microsoft.AspNetCore.Mvc;

namespace CatalogService.Controllers;using Microsoft.AspNetCore.Mvc;

/// <summary>
/// Public endpoints of the catalog service. Each action receives a request from the
/// frontend (or the gateway), asks RAWG through <see cref="RawgClient"/>, and returns the result.
/// </summary>
[ApiController]            // enables automatic 400 responses for invalid input
[Route("api/games")]       // base URL for every action in this class
public class GamesController(RawgClient rawg) : ControllerBase
{
    /// <summary>Searches games by name. GET /api/games?search=zelda&amp;page=1</summary>
    /// <param name="search">Text to look for in game names.</param>
    /// <param name="page">Page number, starting at 1.</param>
    /// <param name="ct">Cancels the call if the client disconnects.</param>
    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string search, [FromQuery] int page = 1, CancellationToken ct = default)
    {
        try
        {
            return Ok(await rawg.SearchGamesAsync(search, page, ct));
        }
        catch (HttpRequestException ex)
        {
            return Problem($"Upstream API error: {ex.StatusCode}", statusCode: 502);
        }
    }

    /// <summary>Returns the full details of one game. GET /api/games/3498</summary>
    /// <param name="id">The RAWG game id.</param>
    /// <param name="ct">Cancellation token.</param>
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct = default)
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
}