# Performance Optimization Roadmap

## Overview
This document outlines the performance optimization strategy for Utah Churches, focusing on reducing page load times and improving global scalability through D1 read replication and KV caching.

## Current State (After Phase 1 & 2)
- **Church detail page**: ~100-150ms load time
- **Optimizations completed**:
  - Phase 1: Parallel query execution with Promise.all()
  - Phase 2: Combined settings queries using IN clause
- **Current query pattern**: 1 sequential query + 4 parallel queries

## Proposed Optimizations

### Phase 3a: KV Settings Cache (Quick Win)
**Impact**: Medium | **Effort**: Low | **Risk**: Low

#### Problem
- Settings (`site_domain`, `site_region`, `r2_image_domain`) are read on every page load
- These values change extremely rarely (maybe once per year)
- Currently fetched from D1 on every request (~16ms)

#### Solution
Implement a KV cache layer for settings with automatic invalidation.

#### Implementation Details
```typescript
// utils/settings-cache.ts
export async function getSettingsWithCache(
  kv: KVNamespace,
  db: D1Database
): Promise<SettingsMap> {
  // Try KV first (500µs-10ms for hot keys)
  const cached = await kv.get('settings:all', 'json');
  if (cached) return cached;
  
  // Fallback to D1
  const settings = await fetchSettingsFromD1(db);
  
  // Cache for 24 hours
  await kv.put('settings:all', JSON.stringify(settings), {
    expirationTtl: 86400
  });
  
  return settings;
}
```

#### Benefits
- Reduce settings fetch from ~16ms to <1ms for cached reads
- Offload read pressure from D1
- Automatic edge caching in all regions

#### Implementation Steps
1. Add KV namespace binding to wrangler.toml
2. Create settings cache utility
3. Update church-detail.tsx to use cache
4. Add cache invalidation to admin settings updates
5. Test cache hit/miss scenarios

### Phase 3b: D1 Read Replication with Sessions API
**Impact**: High | **Effort**: Medium | **Risk**: Low

#### Problem
- All queries currently go to primary D1 instance
- Users globally distributed, but database in single location
- Network latency adds 50-100ms for distant users

#### Solution
Enable D1 read replication to serve reads from replicas closer to users.

#### Implementation Details
```typescript
// middleware/d1-session.ts
export async function withD1Session(c: Context, handler: Handler) {
  // Get or create session bookmark
  const bookmark = c.req.header('x-d1-bookmark') ?? 'first-unconstrained';
  const session = c.env.DB.withSession(bookmark);
  
  // Add session to context
  c.set('dbSession', session);
  
  // Process request
  const response = await handler(c);
  
  // Return bookmark for next request
  response.headers.set('x-d1-bookmark', session.getBookmark() ?? '');
  
  return response;
}
```

#### Benefits
- Serve reads from replicas in WNAM (Western North America) for Utah users
- Reduce read latency by 50-70% for users near replicas
- Scale read throughput across multiple replicas
- Maintain sequential consistency within user sessions

#### Implementation Steps
1. Enable read replication via Cloudflare dashboard or API
2. Create session middleware
3. Update all database queries to use session API
4. Add bookmark handling to Layout component
5. Monitor replica performance metrics

### Phase 4: Advanced Caching Strategies (Future)
**Impact**: High | **Effort**: High | **Risk**: Medium

#### Potential Optimizations
1. **Church Data Edge Caching**
   - Cache frequently accessed churches in KV
   - Use cache tags for granular invalidation
   - TTL based on church update frequency

2. **HTML Fragment Caching**
   - Cache rendered church cards
   - Cache county listings
   - Invalidate on data changes

3. **Smart Query Batching**
   - Combine related queries into single requests
   - Implement DataLoader pattern for N+1 prevention

4. **Cloudflare Cache API**
   - Cache entire HTML responses
   - Use vary headers for personalization
   - Implement stale-while-revalidate

## Performance Targets

| Metric | Current | Phase 3a | Phase 3b | Goal |
|--------|---------|----------|----------|------|
| Church detail (p50) | 100ms | 85ms | 30ms | <50ms |
| Church detail (p95) | 150ms | 135ms | 50ms | <100ms |
| Settings fetch | 16ms | <1ms | <1ms | <1ms |
| Global users | Slow | Slow | Fast | Fast |

## Monitoring & Validation

### Key Metrics
- Query execution time (via D1 analytics)
- KV cache hit rate
- Read replica usage (served_by_region)
- End-to-end page load times
- Geographic performance distribution

### Testing Strategy
1. Benchmark before/after each phase
2. Test from multiple geographic locations
3. Validate cache invalidation flows
4. Load test with concurrent users
5. Monitor error rates during rollout

## Rollout Plan

### Week 1: Phase 3a (KV Settings Cache)
- Day 1-2: Implement KV cache layer
- Day 3: Test and deploy to staging
- Day 4-5: Monitor and deploy to production

### Week 2-3: Phase 3b (D1 Read Replication)
- Day 1-3: Enable replication and implement Sessions API
- Day 4-5: Update all queries to use sessions
- Day 6-7: Test consistency and performance
- Week 2: Gradual rollout with monitoring

### Success Criteria
- [ ] 50% reduction in median page load time
- [ ] 90% cache hit rate for settings
- [ ] 80% of reads served by replicas
- [ ] No increase in error rates
- [ ] Positive user feedback on performance

## Risk Mitigation

### Potential Issues
1. **Cache Inconsistency**
   - Mitigation: Short TTLs, explicit invalidation
   - Rollback: Disable KV cache, serve from D1

2. **Session Bookmark Overhead**
   - Mitigation: Cookie storage, compression
   - Rollback: Use 'first-unconstrained' only

3. **Replica Lag**
   - Mitigation: Monitor lag, adjust consistency
   - Rollback: Route to primary if needed

## Long-term Vision
- Sub-50ms page loads globally
- 10x current traffic capacity
- Real-time updates via WebSockets
- Predictive prefetching
- Edge-rendered components

## References
- [D1 Read Replication Docs](https://developers.cloudflare.com/d1/platform/read-replication/)
- [KV Performance Guide](https://developers.cloudflare.com/kv/platform/performance/)
- [Workers Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)