using AuthService.Models;
using AuthService.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace AuthService.Controllers;

/// <summary>
/// Registration, login and logout. The JWT travels in an HttpOnly cookie,
/// never in the response body.
/// </summary>
[ApiController]
[Route("api/auth")]
public class AuthController(
    UserManager<IdentityUser> userManager,
    SignInManager<IdentityUser> signInManager,
    TokenService tokenService)
    : ControllerBase
{
    private const string CookieName = "access_token";

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
                return Problem(string.Join(" ", duplicates), statusCode: StatusCodes.Status409Conflict);
            }

            foreach (var error in result.Errors)
            {
                ModelState.AddModelError(error.Code, error.Description);
            }
            return ValidationProblem(ModelState);
        }

        return StatusCode(StatusCodes.Status201Created, StartSession(user));
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
            return InvalidCredentials();
        }

        // Counts failed attempts and locks the account after too many. A locked
        // account gets the same answer as a wrong password, so the response
        // never reveals which emails are registered.
        var result = await signInManager.CheckPasswordSignInAsync(
            user, request.Password, lockoutOnFailure: true);
        if (!result.Succeeded)
        {
            return InvalidCredentials();
        }

        return Ok(StartSession(user));
    }

    /// <summary>
    /// Logs the user out by deleting the cookie. POST /api/auth/logout
    /// </summary>
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete(CookieName,TokenCookieOptions());
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
