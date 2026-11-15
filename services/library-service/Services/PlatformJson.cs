using System.Text.Json;
using LibraryService.Dtos;

namespace LibraryService.Services;

/// <summary>
/// Converts the platform list to and from the JSON text stored in one database column.
/// The platforms are only displayed, never searched, so one text column is enough
/// and no extra table is needed.
/// </summary>
public static class PlatformJson
{
    /// <summary>List to JSON text for saving; null when there is nothing to save.</summary>
    public static string? ToJson(List<PlatformEntryDto>? platforms)
        => platforms is { Count: > 0 } ? JsonSerializer.Serialize(platforms) : null;

    /// <summary>JSON text from the database back to a list.</summary>
    public static List<PlatformEntryDto> FromJson(string? json)
    {
        if (string.IsNullOrEmpty(json))
            return [];
        try
        {
            return JsonSerializer.Deserialize<List<PlatformEntryDto>>(json) ?? [];
        }
        catch (JsonException)
        {
            return [];   //  Empty or damaged text gives an empty list.
        }
    }
}
