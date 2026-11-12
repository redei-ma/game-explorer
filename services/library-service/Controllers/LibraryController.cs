using System.Security.Claims;
using LibraryService.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;

namespace LibraryService.Controllers;

/// <summary>
/// Everything library-service stores for the logged-in user, across all lists. It sits apart
/// from the list controllers so that a new list changes only library-service: the frontend
/// never needs to know which tables are here.
/// </summary>
[ApiController]
[Authorize]
[Route("api/library")]
public class LibraryController(LibraryDbContext db, ILogger<LibraryController> logger) : ControllerBase
{
    /// <summary>The caller's user ID, from the verified token (never from the URL or body).</summary>
    private string UserId => User.FindFirstValue(JwtRegisteredClaimNames.Sub)!;

    /// <summary>
    /// DELETE /api/library: removes all of the caller's data, favorites and wishlist.
    /// The frontend calls it right after the account is deleted in auth-service,
    /// so no data of a deleted user is left behind.
    /// </summary>
    [HttpDelete]
    public async Task<IActionResult> RemoveAll(CancellationToken ct)
    {
        var userId = UserId;

        // ExecuteDelete doesn't start a transaction by itself: this one makes the two
        // deletes succeed or fail together
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var favorites = await db.Favorites.Where(f => f.UserId == userId).ExecuteDeleteAsync(ct);
        var wishlist = await db.WishlistItems.Where(w => w.UserId == userId).ExecuteDeleteAsync(ct);
        await transaction.CommitAsync(ct);

        logger.LogInformation("Removed {Favorites} favorites and {Wishlist} wishlist items of user {UserId}",
            favorites, wishlist, userId);
        return NoContent();
    }
}
