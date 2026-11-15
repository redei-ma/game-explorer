using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace AuthService.Data;

/// <summary>
/// EF Core context for Identity's user tables. Derives from IdentityUserContext
/// instead of IdentityDbContext because the app has no roles.
/// </summary>
public class AuthDbContext(DbContextOptions<AuthDbContext> options)
    : IdentityUserContext<IdentityUser>(options)
{
}
