// Shapes of the data sent to API clients (distinct from database entities)
namespace LibraryService.Dtos;

/// <summary>One platform (or platform group): id, display name and URL-friendly name.</summary>
public record PlatformDto(int Id, string Name, string? Slug);

/// <summary>
/// A platform wrapped as { "platform": { ... } }, the same shape catalog-service uses for
/// parentPlatforms, so the frontend can use it as it is.
/// </summary>
public record PlatformEntryDto(PlatformDto Platform);
