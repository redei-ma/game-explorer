using System.ComponentModel.DataAnnotations;

namespace AuthService.Models;

/// <summary>
/// Body of POST /api/auth/register. Password rules are checked by Identity,
/// so the error lists exactly the rules that failed.
/// </summary>
/// <param name="Email">Login email, unique among users.</param>
/// <param name="Username">Name shown in the app, unique among users.</param>
/// <param name="Password">Plain-text password, hashed by Identity before saving.</param>
public record RegisterRequest(
    // 256 is the size of the Email and UserName columns in AspNetUsers.
    [Required, EmailAddress, MaxLength(256)] string Email,
    [Required, MaxLength(256)] string Username,
    [Required] string Password);

/// <summary>
/// Body of POST /api/auth/login.
/// </summary>
/// <param name="Email">Login email.</param>
/// <param name="Password">Plain-text password.</param>
public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password);

/// <summary>
/// Body of POST /api/auth/recover.
/// </summary>
/// <param name="Email">Login email.</param>
/// <param name="Code">Recovery code received at registration or at the last recovery.</param>
/// <param name="NewPassword">The new password, checked by Identity's rules.</param>
public record RecoverRequest(
    [Required, EmailAddress] string Email,
    [Required] string Code,
    [Required] string NewPassword);

/// <summary>
/// Body of DELETE /api/auth/me.
/// </summary>
/// <param name="Password">Current password, asked again before an irreversible action.</param>
public record DeleteAccountRequest([Required] string Password);

/// <summary>
/// Public data of a user, as returned by the API.
/// </summary>
/// <param name="Id">Identity's user id (a GUID), the same as the "sub" claim.</param>
/// <param name="Email">Login email.</param>
/// <param name="Username">Name shown in the app.</param>
public record UserResponse(string Id, string Email, string Username);

/// <summary>
/// Response of login, and base of the register response. The token travels in
/// an HttpOnly cookie, so it is not in the body.
/// </summary>
/// <param name="ExpiresAt">When the token expires (UTC); the user must log in again after it.</param>
/// <param name="User">The user who is now logged in.</param>
public record AuthResponse(DateTime ExpiresAt, UserResponse User);

/// <summary>
/// Response of register: the session plus the recovery code, shown only once.
/// </summary>
/// <param name="ExpiresAt">When the token expires (UTC).</param>
/// <param name="User">The user who is now logged in.</param>
/// <param name="RecoveryCode">Code to save: it resets the password if it gets lost.</param>
public record RegisterResponse(DateTime ExpiresAt, UserResponse User, string RecoveryCode)
    : AuthResponse(ExpiresAt, User);

/// <summary>
/// Response of recover: each code works once, so a new one replaces it.
/// </summary>
/// <param name="RecoveryCode">The new code to save.</param>
public record RecoverResponse(string RecoveryCode);
