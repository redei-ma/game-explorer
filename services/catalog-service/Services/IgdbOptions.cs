using System.ComponentModel.DataAnnotations;

namespace CatalogService.Services;

/// <summary>
/// Twitch application credentials for IGDB, bound from the "Igdb" configuration section.
/// </summary>
public class IgdbOptions
{
    /// <summary>
    /// Name of the configuration section.
    /// </summary>
    public const string SectionName = "Igdb";

    /// <summary>
    /// Sent to Twitch to get a token, and to IGDB in the "Client-ID" header.
    /// </summary>
    [Required]
    public string ClientId { get; set; } = "";

    /// <summary>
    /// Sent only to Twitch, to get a token.
    /// </summary>
    [Required]
    public string ClientSecret { get; set; } = "";
}
