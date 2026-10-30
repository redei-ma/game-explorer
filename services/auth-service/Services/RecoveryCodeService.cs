using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;

namespace AuthService.Services;

/// <summary>
/// Creates and checks the code that lets a user reset a forgotten password.
/// Only its hash is saved, so the database alone can't be used to reset one.
/// </summary>
public class RecoveryCodeService(
    UserManager<IdentityUser> userManager,
    IPasswordHasher<IdentityUser> passwordHasher)
{
    private const string LoginProvider = "GameExplorer";
    private const string TokenName = "RecoveryCode";

    /// <summary>
    /// Creates a code, replacing the previous one, and returns it in plain text.
    /// </summary>
    public async Task<string> CreateAsync(IdentityUser user)
    {
        // 32 hex characters are 128 random bits: too many to guess, and the code
        // never needs to be typed from memory.
        var code = RandomNumberGenerator.GetHexString(32, lowercase: true);
        var hash = passwordHasher.HashPassword(user, code);
        await userManager.SetAuthenticationTokenAsync(user, LoginProvider, TokenName, hash);
        return code;
    }

    /// <summary>
    /// Tells whether the code matches the one saved for the user.
    /// </summary>
    public async Task<bool> VerifyAsync(IdentityUser user, string code)
    {
        var hash = await userManager.GetAuthenticationTokenAsync(user, LoginProvider, TokenName);

        // SuccessRehashNeeded is a match too, so only Failed rejects the code.
        return hash is not null
            && passwordHasher.VerifyHashedPassword(user, hash, code) != PasswordVerificationResult.Failed;
    }
}
