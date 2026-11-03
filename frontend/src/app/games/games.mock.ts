import type {
	Game,
	GameDetailData,
	GamePlatform,
	GenresPage,
	PlatformsPage,
	ScreenshotsResponse,
} from './games.api';

const MOCK_IMAGE =
	'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"%3E%3Crect width="640" height="360" fill="%231b4965"/%3E%3Ccircle cx="320" cy="150" r="80" fill="%235ca4a9"/%3E%3Ctext x="320" y="285" fill="white" font-size="28" text-anchor="middle" font-family="sans-serif"%3EGAME MOCK%3C/text%3E%3C/svg%3E';

const parent = (id: number, name: string, slug: string): GamePlatform => ({
	platform: { id, name, slug },
});

const platform = (id: number, name: string, slug: string): GamePlatform => ({
	platform: { id, name, slug },
});

export const MOCK_GAMES: Game[] = [
	{
		id: 1,
		name: 'The Legend of Zelda: Tears of the Kingdom',
		slug: 'the-legend-of-zelda-tears-of-the-kingdom',
		released: '2023-05-12',
		backgroundImage: MOCK_IMAGE,
		rating: 4.8,
		metacritic: 96,
		parentPlatforms: [parent(7, 'Nintendo', 'nintendo')],
		platforms: [platform(7, 'Nintendo Switch', 'nintendo-switch')],
	},
	{
		id: 2,
		name: 'Hades',
		slug: 'hades',
		released: '2020-09-17',
		backgroundImage: MOCK_IMAGE,
		rating: 4.6,
		metacritic: 93,
		parentPlatforms: [
			parent(1, 'PC', 'pc'),
			parent(2, 'PlayStation', 'playstation'),
			parent(3, 'Xbox', 'xbox'),
		],
		platforms: [
			platform(4, 'PC', 'pc'),
			platform(5, 'PlayStation 5', 'playstation5'),
			platform(6, 'Xbox Series S/X', 'xbox-series-s-x'),
		],
	},
];

export const MOCK_GENRES: GenresPage = {
	count: 2,
	results: [
		{ id: 1, name: 'Action', slug: 'action' },
		{ id: 2, name: 'Adventure', slug: 'adventure' },
	],
};

export const MOCK_PLATFORMS: PlatformsPage = {
	count: 3,
	results: [
		{ id: 1, name: 'PC', slug: 'pc' },
		{ id: 2, name: 'PlayStation', slug: 'playstation' },
		{ id: 3, name: 'Xbox', slug: 'xbox' },
	],
};

export const MOCK_DETAILS: Record<number, GameDetailData> = {
	1: {
		...MOCK_GAMES[0],
		descriptionRaw:
			'Un epico viaggio attraverso Hyrule e le isole sospese nel cielo.',
		developers: [{ id: 1, name: 'Nintendo EPD', slug: 'nintendo-epd' }],
		publishers: [{ id: 1, name: 'Nintendo', slug: 'nintendo' }],
		genres: [{ id: 2, name: 'Adventure', slug: 'adventure' }],
	},
	2: {
		...MOCK_GAMES[1],
		descriptionRaw:
			'Combatti per uscire dagli inferi in questo roguelike d’azione.',
		developers: [{ id: 2, name: 'Supergiant Games', slug: 'supergiant-games' }],
		publishers: [{ id: 2, name: 'Supergiant Games', slug: 'supergiant-games' }],
		genres: [{ id: 1, name: 'Action', slug: 'action' }],
	},
};

export const MOCK_SCREENSHOTS: Record<number, ScreenshotsResponse> = {
	1: {
		count: 2,
		results: [
			{
				id: 1,
				image:
					MOCK_IMAGE,
			},
			{
				id: 2,
				image:
					MOCK_IMAGE,
			},
		],
	},
	2: {
		count: 1,
		results: [
			{
				id: 3,
				image:
					MOCK_IMAGE,
			},
		],
	},
};
