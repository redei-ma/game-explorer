using System.ComponentModel.DataAnnotations;

namespace AuthService.Services;

/// <summary>
/// Settings for signing JWTs, bound from the "Jwt" configuration section.
/// </summary>
public class JwtOptions
{
    public const string SectionName = "Jwt";

    /// <summary>
    /// HMAC key shared with library-service. RFC 7518 requires at least
    /// 256 bits for HS256, which is 32 ASCII characters.
    /// </summary>
    [Required, MinLength(32)]
    public string Key { get; set; } = "";

    /// <summary>
    /// The service that issues the token (the "iss" claim).
    /// </summary>
    [Required]
    public string Issuer { get; set; } = "";

    /// <summary>
    /// The services the token is meant for (the "aud" claim).
    /// </summary>
    [Required]
    public string Audience { get; set; } = "";

    /// <summary>
    /// How long a token stays valid, in hours.
    /// </summary>
    [Range(1, 168)]
    public int ExpirationHours { get; set; }
}
