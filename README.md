## TenderSpot

B2B dashboard for tender monitoring with closed invite-token access and Appwrite-backed data.

### What Is Implemented

- Full brand cleanup and updated rhombus branding
- Invite-token authentication flow (no public sign-up)
- Appwrite integration for tenders list and updates
- Optimistic UI updates + realtime synchronization
- Standalone parser service skeleton (`services/parser`) with adapter strategy

### Frontend Structure

```text
src/
	auth/
		AuthContext.tsx
		ProtectedRoute.tsx
	components/
		branding/
			BlueRhombusLogo.tsx
		features/
		layout/
		ui/
	config/
		env.ts
	hooks/
		useTenders.ts
		useTheme.ts
	lib/
		appwrite.ts
		utils.ts
	pages/
		Index.tsx
		Login.tsx
		NotFound.tsx
	services/
		inviteAuth.ts
		tenders.ts
	types/
		tender.ts
```

### Parser Service Structure

```text
services/parser/
	src/
		adapters/
			eis/
				eis.adapter.ts
				eis.extract.ts
		config/
			env.ts
		core/
			etl-runner.ts
			source-adapter.ts
		loaders/
			appwrite-loader.ts
		index.ts
```

### Environment

1. Copy `.env.example` to `.env`
2. Fill Appwrite variables:
- `VITE_APPWRITE_ENDPOINT`
- `VITE_APPWRITE_PROJECT_ID`
- `VITE_APPWRITE_DATABASE_ID`
- `VITE_APPWRITE_COLLECTION_ID` (or `VITE_APPWRITE_TENDERS_COLLECTION_ID`)
- `VITE_APPWRITE_INVITE_TOKENS_COLLECTION_ID`

### Parser Environment

1. Copy `services/parser/.env.example` to `services/parser/.env`
2. Fill parser Appwrite API key and scheduler variables

### Scripts

- `npm run dev` - start frontend
- `npm run build` - build frontend
- `npm run parser:install` - install parser deps
- `npm run parser:run` - run parser once
- `npm run parser:schedule` - run parser in cron mode

