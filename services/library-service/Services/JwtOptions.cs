using System.ComponentModel.DataAnnotations;

namespace LibraryService.Services;

/// <summary>
/// Settings for signing JWTs, bound from the "Jwt" configuration section.
/// </summary>
public class JwtOptions
{
    /// <summary>
    /// Name of the configuration section.
    /// </summary>
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
}
