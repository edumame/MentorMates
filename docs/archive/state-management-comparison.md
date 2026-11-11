# State Management Guide: nuqs vs Zustand vs Redux

A comprehensive comparison of state management solutions for React/Next.js applications.

---

## **nuqs** - URL State Management

### When to Use
- State should be **shareable via URL** (filters, pagination, tabs, search queries)
- You want **browser back/forward** to work with your state
- State should **persist across page refreshes**
- You're working with **Next.js App Router** specifically
- You want **type-safe URL params** with validation

### Examples

```typescript
// Search filters on an e-commerce page
const [search, setSearch] = useQueryState('q')
const [category, setCategory] = useQueryState('category')
const [minPrice, setMinPrice] = useQueryState('minPrice', parseAsInteger)

// Data table with pagination and sorting
const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
const [sortBy, setSortBy] = useQueryState('sort')
const [filters, setFilters] = useQueryState('filters', parseAsJson())
```

### In MentorMates Project
- Event list filters (status, category, date range)
- Project submission search/filters
- Participant list pagination and sorting
- Any dashboard filters that users might want to bookmark

---

## **Zustand** - Lightweight Global State

### When to Use
- You need **global state** shared across multiple components
- State **doesn't need to persist** in URL
- You want something **simpler than Redux**
- You need **minimal boilerplate**
- Performance is important (selective subscriptions)

### Examples

```typescript
// Global UI state
const useUIStore = create((set) => ({
  sidebarOpen: false,
  theme: 'light',
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
}))

// Shopping cart
const useCartStore = create((set) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) => set((state) => ({ 
    items: state.items.filter(item => item.id !== id) 
  })),
  total: () => state.items.reduce((sum, item) => sum + item.price, 0),
}))

// Current user session data
const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  login: (user) => set({ user, isAuthenticated: true }),
  logout: () => set({ user: null, isAuthenticated: false }),
}))
```

### In MentorMates Project
- **Toast notifications** (you're already using a hook, but could be global)
- **Modal state** (open/close modals from anywhere)
- **Draft form data** (auto-save across components)
- **Real-time notifications** (WebSocket data shared across app)
- **User preferences** (UI settings that don't need URL persistence)

---

## **Redux (+ Redux Toolkit)** - Enterprise State Management

### When to Use
- You have **complex state logic** with many actions
- You need **time-travel debugging** (dev tools)
- Your team is **already familiar** with Redux patterns
- You need **middleware** for complex async flows (sagas, observables)
- You're building a **large enterprise app** with many developers
- You need **strict patterns** and predictability

### Examples

```typescript
// Complex data with many related actions
const projectsSlice = createSlice({
  name: 'projects',
  initialState: {
    items: [],
    selectedProject: null,
    filters: {},
    loading: false,
    error: null,
  },
  reducers: {
    setProjects: (state, action) => { state.items = action.payload },
    selectProject: (state, action) => { state.selectedProject = action.payload },
    updateProject: (state, action) => {
      const index = state.items.findIndex(p => p.id === action.payload.id)
      if (index !== -1) state.items[index] = action.payload
    },
    setFilters: (state, action) => { state.filters = action.payload },
    // ... many more actions
  },
  extraReducers: (builder) => {
    // Handle async thunks
    builder.addCase(fetchProjects.pending, (state) => {
      state.loading = true
    })
    // ... more async handling
  },
})

// Complex form wizard with validation
const formWizardSlice = createSlice({
  name: 'formWizard',
  initialState: {
    step: 1,
    data: {},
    errors: {},
    touched: {},
    isValid: false,
  },
  reducers: {
    nextStep: (state) => { state.step += 1 },
    previousStep: (state) => { state.step -= 1 },
    updateField: (state, action) => {
      state.data[action.payload.field] = action.payload.value
      state.touched[action.payload.field] = true
    },
    // ... validation logic
  },
})
```

### In MentorMates Project
- **Only if** you were building a much larger app with 10+ developers
- **Only if** you need Redux DevTools for debugging complex flows
- **Probably overkill** for MentorMates current size

---

## Comparison Table

| Scenario | Best Choice | Why |
|----------|-------------|-----|
| Tab selection | **URL params** (native or nuqs) | Shareable, bookmarkable |
| Search filters | **nuqs** | Type-safe URL state |
| Modal open/closed | **Zustand** or React Context | Doesn't need URL |
| Shopping cart | **Zustand** | Global, doesn't need URL |
| User session | **Zustand** or React Context | Global, temporary |
| Complex wizard form | **Redux** or Zustand | Depends on complexity |
| Toast notifications | **Zustand** or custom hook | Simple global state |
| Real-time chat messages | **Zustand** | Global, frequently updated |
| Large enterprise app | **Redux Toolkit** | Structure, debugging |

---

## Recommendations for MentorMates

### Use nuqs for:
1. **Event list filters** on `/events` page
2. **Project submission filters** (status, track, search)
3. **Participant list** pagination/sorting
4. **Any dashboard filters** organizers might want to share

### Use Zustand for:
1. **Draft auto-save** for long forms (project submission, event creation)
2. **Global notification state** (if you want more than toast)
3. **User preferences** (sidebar collapsed, view mode, etc.)
4. **Real-time updates** if you add WebSockets

### Don't use Redux unless:
- Your app grows 5x in complexity
- You have 10+ developers needing strict patterns
- You need time-travel debugging for complex state flows

---

## Quick Implementation Example

### Using nuqs for Event Filters

```typescript
// components/eventsPageClient.tsx
import { useQueryState, parseAsString, parseAsArrayOf } from 'nuqs'

export function EventsPageClient() {
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''))
  const [status, setStatus] = useQueryState('status', parseAsString)
  const [categories, setCategories] = useQueryState(
    'categories', 
    parseAsArrayOf(parseAsString).withDefault([])
  )
  
  // Now these are in URL and shareable!
  // /events?search=hackathon&status=upcoming&categories=tech,design
}
```

### Using Zustand for Global State

```typescript
// stores/useUIStore.ts
import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  theme: 'light' | 'dark'
  toggleSidebar: () => void
  setTheme: (theme: 'light' | 'dark') => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  theme: 'light',
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
}))

// Usage in any component
import { useUIStore } from '@/stores/useUIStore'

function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore()
  return (
    <div className={sidebarOpen ? 'open' : 'closed'}>
      <button onClick={toggleSidebar}>Toggle</button>
    </div>
  )
}
```

---

## Bottom Line

For most React/Next.js apps, you can get by with:
- **URL params** (native or nuqs) for shareable state
- **Zustand** for simple global state
- **React Context + hooks** for component-tree state
- **Redux** only when complexity demands it

**Start simple, add complexity only when needed.**

