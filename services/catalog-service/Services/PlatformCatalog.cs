using CatalogService.Models;

namespace CatalogService.Services;

/// <summary>
/// Recreates RAWG's "parent platforms" (PC, PlayStation, Xbox, Nintendo...) on top of IGDB.
/// </summary>
/// <remarks>
/// IGDB groups consoles into "platform families" (PlayStation, Xbox, Nintendo, Sega, Linux),
/// but PC, Mac and iOS belong to NO family, and Android is filed under Linux, which is
/// wrong for a game catalog. To keep the frontend's first dropdown and the platform icons
/// on the cards, we define those four as hand-made groups that override IGDB's family.
/// Their group ids are 1000 + the IGDB platform id, so they can never clash with real
/// family ids (which are small numbers).
/// One instance is built from the full IGDB platform list and cached for 24 hours by IgdbClient.
/// </remarks>
public sealed class PlatformCatalog
{
    // IGDB platform id -> (group id, display name, slug). The slugs match RAWG's,
    // in case the frontend picks icons by slug.
    private static readonly Dictionary<int, (int GroupId, string Name, string Slug)> StandaloneGroups = new()
    {
        [6]  = (1006, "PC", "pc"),                 // 6  = PC (Microsoft Windows)
        [14] = (1014, "Apple Macintosh", "mac"),   // 14 = Mac
        [39] = (1039, "iOS", "ios"),               // 39 = iOS
        [34] = (1034, "Android", "android"),       // 34 = Android
    };

    // platform id -> its group, for the icons on each card
    private readonly Dictionary<int, NamedItem> _groupByPlatformId;

    // group id -> the platform ids inside it, to turn a parentPlatforms filter into a platforms filter
    private readonly Dictionary<int, List<int>> _platformIdsByGroupId;

    /// <summary>The groups, shaped exactly like RAWG's /platforms/lists/parents answer.</summary>
    public IReadOnlyList<CatalogItem> Groups { get; }

    /// <summary>Every platform that belongs to a group, sorted by name. Obscure platforms are left out.</summary>
    public IReadOnlyList<CatalogItem> Platforms { get; }

    /// <summary>Private: use <see cref="Build"/>, which does the grouping work.</summary>
    private PlatformCatalog(
        Dictionary<int, NamedItem> groupByPlatformId,
        Dictionary<int, List<int>> platformIdsByGroupId,
        IReadOnlyList<CatalogItem> groups,
        IReadOnlyList<CatalogItem> platforms)
    {
        _groupByPlatformId = groupByPlatformId;
        _platformIdsByGroupId = platformIdsByGroupId;
        Groups = groups;
        Platforms = platforms;
    }

    /// <summary>
    /// Sorts every IGDB platform into its group (family, or one of the hand-made groups)
    /// and builds the lookup tables. Platforms that fit no group are skipped.
    /// </summary>
    /// <param name="all">The complete list from IGDB's "platforms" endpoint.</param>
    public static PlatformCatalog Build(IEnumerable<IgdbPlatform> all)
    {
        var groupByPlatformId = new Dictionary<int, NamedItem>();
        var children = new Dictionary<int, List<NamedItem>>();
        var groupInfo = new Dictionary<int, NamedItem>();

        foreach (var p in all)
        {
            NamedItem? group = null;

            // The hand-made groups are checked FIRST, so they win over IGDB's family.
            // This matters for Android: IGDB puts it in the Linux family, which would
            // make Linux filters return Android games and Android cards show "Linux".
            if (StandaloneGroups.TryGetValue(p.Id, out var s))        // PC, Mac, iOS, Android
                group = new NamedItem(s.GroupId, s.Name, s.Slug);
            else if (p.PlatformFamily is { } family)                  // console with a family
                group = new NamedItem(family.Id, family.Name, family.Slug);

            if (group is null)
                continue;                                             // arcade, obscure systems...

            groupByPlatformId[p.Id] = group;
            groupInfo.TryAdd(group.Id, group);
            if (!children.TryGetValue(group.Id, out var list))
                children[group.Id] = list = [];
            list.Add(new NamedItem(p.Id, p.Name, p.Slug));
        }

        var groups = groupInfo.Values
            .OrderBy(g => g.Name)
            .Select(g => new CatalogItem(g.Id, g.Name, g.Slug ?? "", GamesCount: null,
                                         Platforms: children[g.Id].OrderBy(c => c.Name).ToList()))
            .ToList();

        var platforms = children.Values
            .SelectMany(c => c)
            .OrderBy(p => p.Name)
            .Select(p => new CatalogItem(p.Id, p.Name, p.Slug ?? "", GamesCount: null))
            .ToList();

        var idsByGroup = children.ToDictionary(kv => kv.Key, kv => kv.Value.Select(p => p.Id).ToList());

        return new PlatformCatalog(groupByPlatformId, idsByGroup, groups, platforms);
    }

    /// <summary>Returns the group (e.g. "PlayStation") a platform belongs to, or null.</summary>
    /// <param name="platformId">IGDB platform id.</param>
    public NamedItem? GroupOf(int platformId) => _groupByPlatformId.GetValueOrDefault(platformId);

    /// <summary>
    /// Returns all platform ids in a group, e.g. PlayStation -> PS1, PS2, ..., PS5.
    /// </summary>
    /// <param name="groupId">A group id from <see cref="Groups"/>.</param>
    /// <exception cref="ArgumentException">The id is not a known group (the controller turns this into 400).</exception>
    public IReadOnlyList<int> PlatformIdsOf(int groupId)
        => _platformIdsByGroupId.TryGetValue(groupId, out var ids)
            ? ids
            : throw new ArgumentException($"Unknown parent platform id {groupId}.");
}
