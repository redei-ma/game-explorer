using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace AuthService.Services;

/// <summary>
/// Creates the signed JWTs that identify a user to the other services.
/// </summary>
public class TokenService(IOptions<JwtOptions> options)
{
    private readonly JwtOptions _options = options.Value;
    private readonly JsonWebTokenHandler _handler = new();

    /// <summary>
    /// Creates a token for the user and returns it with its expiry time.
    /// </summary>
    public (string Token, DateTime ExpiresAt) CreateToken(IdentityUser user)
    {
        var expiresAt = DateTime.UtcNow.AddHours(_options.ExpirationHours);
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Key));

        var token = _handler.CreateToken(new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(
            [
                new Claim(JwtRegisteredClaimNames.Sub, user.Id),
                new Claim(JwtRegisteredClaimNames.Email, user.Email!),
                new Claim(JwtRegisteredClaimNames.UniqueName, user.UserName!),
            ]),
            Issuer = _options.Issuer,
            Audience = _options.Audience,
            Expires = expiresAt,
            SigningCredentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256),
        });

        return (token, expiresAt);
    }
}
