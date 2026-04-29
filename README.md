# Panorama Viewer Pro

360° 全景 viewer，支援在球體場景上放置與拖曳 3D 註解標記。

## Tech Stack

- **Vite** + **React 19** + **TypeScript**
- **Three.js** — 3D 球體全景渲染
- **Supabase** — 認證（Google OAuth）與 Storage（全景圖 + 註解持久化）
- **Vitest** — 單元測試（82 passing）

## Features

- 360° 全景瀏覽（滑鼠拖曳旋轉視角）
- 註解標記系統：點擊場景放置標記，拖曳可移動位置
- Edge auto-pan：拖曳註解時滑鼠靠近邊緣，相機會自動平移
- Google 登入（Supabase Auth）
- 全景圖上傳（Supabase Storage，20MB 限制）
- Responsive container 支援

## Getting Started

```bash
npm install
npm run dev
```

需有 `.env` 檔包含 Supabase 專案 credentials：

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Scripts

```bash
npm run dev        # 開發 server
npm run build      # TypeScript check + Vite build
npm test           # Vitest（自動切 Node 22）
npm run lint       # ESLint
```

## Architecture

- `PanoramaViewer.tsx` — Three.js 球體全景渲染、相機控制（`longitudeRef`/`latitudeRef`）
- `AnnotationLayer.tsx` — DOM 層疊加於 canvas 上，處理所有註解互動（放置、拖曳、edge auto-pan、world/screen 座標轉換）
- `App.tsx` — 狀態管理（annotations list）、編輯模式切換、Supabase 資料同步

### Coordinate System

- 全景座標：球面上 3D 點 `{x, y, z}`
- 螢幕座標：2D pixel `{screenX, screenY}`
- 轉換：`unprojectToWorld(screenX, screenY)` / `projectToScreen(worldPos)` 透過 raycaster 與 camera projection

### Annotation Drag + Edge Auto-pan

1. `handlePointerDown`：capture `dragStartProjectedRef`（當下 annotation 的 screen 位置）與 `dragCursorX/YRef`
2. `handlePointerMove`：更新 `dragDeltaX/YRef`，偵測邊緣並寫入 `cameraPanRef` 驅動相機旋轉，同時累積到 `cumulativePanLon/LatRef`
3. RAF loop：用 `dragStartProjectedRef + dragDelta + cumulativePanOffset` 計算當前 screen 位置
4. `handlePointerUp`：扣除 cumulative pan 補償後 unproject 回 world position，更新 React state

## Supabase Schema

需手動在 Supabase Dashboard 建立：

```sql
-- panoramas table
create table panoramas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  title text,
  image_url text not null,
  created_at timestamptz default now()
);

-- annotations table
create table annotations (
  id uuid primary key default gen_random_uuid(),
  panorama_id uuid references panoramas(id) on delete cascade,
  position jsonb not null,  -- {x, y, z}
  content text,
  created_at timestamptz default now()
);

-- Storage bucket: 'panoramas' (public, 20MB limit)
```

### Storage Policy (RLS)

```sql
-- panoramas: 所有者可讀寫
create policy "Owner read/write panoramas"
  on storage.objects for all
  using (bucket_id = 'panoramas')
  with check (bucket_id = 'panoramas');
```

## Deploy

Vercel auto-deploys from GitHub `main` branch.

Set environment variables in Vercel Dashboard → Settings → Environment Variables:

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```
