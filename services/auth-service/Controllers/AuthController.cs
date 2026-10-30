using System.Security.Claims;
using AuthService.Models;
using AuthService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.JsonWebTokens;

namespace AuthService.Controllers;

/// <summary>
/// Registration, login, logout and password recovery. The JWT travels in an
/// HttpOnly cookie, never in the response body. Logs identify users by id, never
/// by email, which is personal data.
/// </summary>
[ApiController]
[Route("api/auth")]
public class AuthController(
    UserManager<IdentityUser> userManager,
    SignInManager<IdentityUser> signInManager,
    TokenService tokenService,
    RecoveryCodeService recoveryCodes,
    ILogger<AuthController> logger)
    : ControllerBase
{
    /// <summary>
    /// Name of the cookie that holds the JWT.
    /// </summary>
    public const string CookieName = "access_token";

    /// <summary>
    /// Creates a user and logs them in. POST /api/auth/register
    /// </summary>
    /// <param name="request">Email, username and password of the new user.</param>
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var user = new IdentityUser { UserName = request.Username, Email = request.Email };
        var result = await userManager.CreateAsync(user, request.Password);

        if (!result.Succeeded)
        {
            var duplicates = result.Errors
                .Where(e => e.Code is "DuplicateEmail" or "DuplicateUserName")
                .Select(e => e.Description)
                .ToList();
            if (duplicates.Count > 0)
            {
                logger.LogWarning("Registration rejected: email or username already taken");
                return Problem(string.Join(" ", duplicates), statusCode: StatusCodes.Status409Conflict);
            }

            foreach (var error in result.Errors)
            {
                ModelState.AddModelError(error.Code, error.Description);
            }
            return ValidationProblem(ModelState);
        }

        var recoveryCode = await recoveryCodes.CreateAsync(user);
        var session = StartSession(user);

        logger.LogInformation("User {UserId} registered", user.Id);
        return StatusCode(
            StatusCodes.Status201Created,
            new RegisterResponse(session.ExpiresAt, session.User, recoveryCode));
    }

    /// <summary>
    /// Checks email and password and logs the user in. POST /api/auth/login
    /// </summary>
    /// <param name="request">Email and password.</param>
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var user = await userManager.FindByEmailAsync(request.Email);
        if (user is null)
        {
            logger.LogWarning("Login failed: unknown email");
            return InvalidCredentials();
        }

        // lockoutOnFailure counts failed attempts toward the lockout. A locked
        // account gets the same answer as a wrong password: a different message
        // would reveal that the email is registered.
        var result = await signInManager.CheckPasswordSignInAsync(
            user, request.Password, lockoutOnFailure: true);
        if (!result.Succeeded)
        {
            logger.LogWarning(
                "Login failed for user {UserId}, locked out: {IsLockedOut}", user.Id, result.IsLockedOut);
            return InvalidCredentials();
        }

        logger.LogInformation("User {UserId} logged in", user.Id);
        return Ok(StartSession(user));
    }

    /// <summary>
    /// Sets a new password with the recovery code. POST /api/auth/recover
    /// </summary>
    /// <param name="request">Email, recovery code and new password.</param>
    [HttpPost("recover")]
    public async Task<IActionResult> Recover(RecoverRequest request)
    {
        var user = await userManager.FindByEmailAsync(request.Email);
        if (user is null)
        {
            logger.LogWarning("Recovery failed: unknown email");
            return InvalidRecovery();
        }

        if (await userManager.IsLockedOutAsync(user))
        {
            logger.LogWarning("Recovery refused for locked user {UserId}", user.Id);
            return InvalidRecovery();
        }

        // A wrong code counts toward the same lockout as a wrong password.
        if (!await recoveryCodes.VerifyAsync(user, request.Code))
        {
            await userManager.AccessFailedAsync(user);
            logger.LogWarning("Recovery failed for user {UserId}", user.Id);
            return InvalidRecovery();
        }

        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        var result = await userManager.ResetPasswordAsync(user, token, request.NewPassword);
        if (!result.Succeeded)
        {
            foreach (var error in result.Errors)
            {
                ModelState.AddModelError(error.Code, error.Description);
            }
            return ValidationProblem(ModelState);
        }

        await userManager.ResetAccessFailedCountAsync(user);
        logger.LogInformation("User {UserId} reset their password", user.Id);
        return Ok(new RecoverResponse(await recoveryCodes.CreateAsync(user)));
    }

    /// <summary>
    /// Returns the logged-in user, read from the token. GET /api/auth/me
    /// </summary>
    [Authorize]
    [HttpGet("me")]
    public IActionResult Me() => Ok(new UserResponse(
        User.FindFirstValue(JwtRegisteredClaimNames.Sub)!,
        User.FindFirstValue(JwtRegisteredClaimNames.Email)!,
        User.FindFirstValue(JwtRegisteredClaimNames.UniqueName)!));

    /// <summary>
    /// Logs the user out by deleting the cookie. POST /api/auth/logout
    /// </summary>
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete(CookieName, TokenCookieOptions());
        return NoContent();
    }

    /// <summary>
    /// Creates the token, puts it in the cookie and builds the response body.
    /// </summary>
    private AuthResponse StartSession(IdentityUser user)
    {
        var (token, expiresAt) = tokenService.CreateToken(user);

        var options = TokenCookieOptions();
        options.Expires = expiresAt;
        Response.Cookies.Append(CookieName, token, options);

        return new AuthResponse(expiresAt, new UserResponse(user.Id, user.Email!, user.UserName!));
    }

    /// <summary>
    /// The single answer for every failed login.
    /// </summary>
    private ObjectResult InvalidCredentials() =>
        Problem("Invalid email or password.", statusCode: StatusCodes.Status401Unauthorized);

    /// <summary>
    /// The single answer for every failed recovery.
    /// </summary>
    private ObjectResult InvalidRecovery() =>
        Problem("Invalid email or recovery code.", statusCode: StatusCodes.Status401Unauthorized);

    /// <summary>
    /// The cookie's attributes, shared by login and logout so the cookie that
    /// gets deleted is the same one that was set.
    /// </summary>
    private static CookieOptions TokenCookieOptions() => new()
    {
        // HttpOnly keeps the token away from JavaScript; SameSite=Strict and
        // Path=/api limit when the browser sends it back.
        HttpOnly = true,
        Secure = true,
        SameSite = SameSiteMode.Strict,
        Path = "/api",
    };
}
