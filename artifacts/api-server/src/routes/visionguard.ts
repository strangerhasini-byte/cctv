import {
  AskAboutEvidenceBody,
  AskAboutEvidenceResponse,
  CreateAlertBody,
  CreateAlertResponse,
  CreateInvestigationBody,
  CreateInvestigationResponse,
  CreateReportBody,
  CreateReportResponse,
  CreateVideoBody,
  CreateVideoResponse,
  GetAlertsResponse,
  GetEventsResponse,
  GetInvestigationsResponse,
  GetReportsResponse,
  GetVideosResponse,
  GetVisionDashboardResponse,
  ReviewEventBody,
  ReviewEventParams,
  ReviewEventResponse,
  SearchEvidenceBody,
  SearchEvidenceResponse,
  UpdateAlertStatusBody,
  UpdateAlertStatusParams,
  UpdateAlertStatusResponse,
} from "@workspace/api-zod";
import {
  alertsTable,
  db,
  eventsTable,
  investigationsTable,
  reportsTable,
  videosTable,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
type EventRecord = typeof eventsTable.$inferSelect;

function authenticatedUser(req: Request, res: Response): string | null {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Sign in to access this security workspace." });
    return null;
  }
  return req.user.id;
}

async function ensureDemoData(userId: string) {
  await db.transaction(async (tx) => {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
  const existing = await tx
    .select({ id: videosTable.id })
    .from(videosTable)
    .where(eq(videosTable.userId, userId))
    .limit(1);
  if (existing.length) return;

  const videos = await tx
    .insert(videosTable)
    .values([
      {
        userId,
        name: "warehouse-entrance-04.mp4",
        camera: "Warehouse Entrance · Cam 04",
        location: "North warehouse",
        uploadedAt: new Date("2026-10-08T09:14:00.000Z"),
        durationSeconds: 2538,
        resolution: "1920 × 1080",
        status: "analyzed",
        peopleCount: 42,
        eventCount: 8,
        alertCount: 2,
        riskLevel: "high",
        summary: "Sample analysis with three findings marked for human review.",
        fileSizeBytes: 842000000,
        source: "demo",
      },
      {
        userId,
        name: "loading-dock-morning.mp4",
        camera: "Loading Dock · Cam 02",
        location: "Loading dock",
        uploadedAt: new Date("2026-10-08T07:05:00.000Z"),
        durationSeconds: 1492,
        resolution: "1920 × 1080",
        status: "analyzed",
        peopleCount: 18,
        eventCount: 5,
        alertCount: 1,
        riskLevel: "medium",
        summary: "Sample analysis: routine vehicle and loading activity.",
        fileSizeBytes: 476000000,
        source: "demo",
      },
      {
        userId,
        name: "lobby-evening.mp4",
        camera: "Main Lobby · Cam 01",
        location: "Main office",
        uploadedAt: new Date("2026-10-07T20:32:00.000Z"),
        durationSeconds: 1000,
        resolution: "1280 × 720",
        status: "analyzed",
        peopleCount: 26,
        eventCount: 4,
        alertCount: 0,
        riskLevel: "low",
        summary: "Sample analysis: activity stayed within the expected range.",
        fileSizeBytes: 291000000,
        source: "demo",
      },
    ])
    .returning();

  const [warehouse, dock, lobby] = videos;
  const sampleEvents = [
    [warehouse, 134, "Person entered", "normal", 0.96, "A person entered the camera view from the north entrance.", "North entrance"],
    [warehouse, 1072, "Restricted-zone entry", "suspicious", 0.94, "A person appears to cross into a marked restricted area. Verify authorization before taking action.", "Restricted zone"],
    [warehouse, 1270, "Unattended object", "warning", 0.82, "An object appears to remain stationary after a nearby person leaves the area.", "Packing aisle"],
    [warehouse, 1722, "Elevated crowd density", "warning", 0.89, "The number of visible people increased above the sample threshold.", "Loading aisle"],
    [warehouse, 2058, "Restricted-zone exit", "normal", 0.91, "A person appears to leave the marked restricted area.", "Restricted zone"],
    [dock, 225, "Vehicle entered", "normal", 0.97, "A vehicle entered the loading area.", "Loading bay 2"],
    [dock, 613, "Person remained stationary", "warning", 0.79, "A person remained in one area for longer than the configured sample threshold.", "Loading bay 2"],
    [lobby, 318, "After-hours activity", "info", 0.87, "Movement was detected during the sample after-hours window.", "Main lobby"],
  ] as const;

  const insertedEvents = await tx
    .insert(eventsTable)
    .values(
      sampleEvents.map(([video, timestampSeconds, eventType, severity, confidence, description, location]) => ({
        userId,
        videoId: video.id,
        videoName: video.name,
        timestampSeconds,
        eventType,
        severity,
        confidence,
        description,
        location,
        reviewStatus: severity === "suspicious" || severity === "warning" ? "needs_review" : "confirmed",
        evidenceLabel: "Sample evidence record",
      })),
    )
    .returning();

  const restrictedEvent = insertedEvents.find(
    (event) => event.eventType === "Restricted-zone entry",
  );
  await tx.insert(investigationsTable).values({
    userId,
    title: "Restricted-area activity · Warehouse",
    severity: "high",
    status: "investigating",
    eventIds: restrictedEvent ? [restrictedEvent.id] : [],
    notes: "Sample case. Verify this finding against the original recording before acting.",
  });
  await tx.insert(alertsTable).values([
    {
      userId,
      name: "Restricted area entry",
      trigger: "Person enters the restricted zone",
      severity: "high",
      status: "active",
    },
    {
      userId,
      name: "Unattended object",
      trigger: "Object remains after a person leaves",
      severity: "medium",
      status: "active",
    },
    {
      userId,
      name: "Crowd threshold",
      trigger: "More than 10 people in a zone for 2 minutes",
      severity: "medium",
      status: "paused",
    },
  ]);
  await tx.insert(reportsTable).values({
    userId,
    title: "Warehouse entrance · Sample review",
    videoId: warehouse.id,
    severity: "high",
    summary: "Sample report containing a restricted-zone finding and two items for human review.",
  });
  });
}

async function getOwnedEvents(userId: string, videoId?: string) {
  const filters = videoId
    ? and(eq(eventsTable.userId, userId), eq(eventsTable.videoId, videoId))
    : eq(eventsTable.userId, userId);
  return db
    .select()
    .from(eventsTable)
    .where(filters)
    .orderBy(eventsTable.timestampSeconds);
}

function searchableText(event: EventRecord) {
  return `${event.eventType} ${event.description} ${event.location} ${event.videoName}`.toLowerCase();
}

function matchQuery(events: EventRecord[], query: string) {
  const excluded = new Set([
    "the", "and", "for", "with", "show", "find", "when", "what", "this", "that",
    "were", "was", "did", "does", "who", "where", "why", "how", "video", "videos",
    "recording", "recordings", "recorded", "event", "events", "activity", "activities",
    "happened", "occurred", "tell", "about", "all", "me", "any", "during",
  ]);
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !excluded.has(term));
  if (!terms.length) {
    const asksBroadlyAboutEvidence = /\b(what|which|show|list|summari[sz]e|tell|happened|events?|activity|recordings?)\b/i.test(query);
    return asksBroadlyAboutEvidence ? events : [];
  }
  return events
    .map((event) => ({
      event,
      score: terms.filter((term) => {
        const text = searchableText(event);
        const singular = term.endsWith("s") ? term.slice(0, -1) : term;
        return text.includes(term) || text.includes(singular);
      }).length,
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ event }) => event);
}

router.get("/visionguard/dashboard", async (req, res) => {
  const userId = authenticatedUser(req, res);
  if (!userId) return;
  try {
    await ensureDemoData(userId);
    const [videos, events, alerts] = await Promise.all([
      db.select().from(videosTable).where(eq(videosTable.userId, userId)),
      getOwnedEvents(userId),
      db.select().from(alertsTable).where(eq(alertsTable.userId, userId)),
    ]);
    const unusual = events.filter((event) => ["warning", "suspicious", "critical"].includes(event.severity));
    const cameras = Array.from(
      new Map(videos.map((video) => [video.camera, video])).values(),
    ).map((video) => ({
      name: video.camera,
      location: video.location,
      status: video.status === "processing" ? "processing" : "online",
      activity: video.riskLevel === "high" ? "elevated" : video.riskLevel === "critical" ? "critical" : "normal",
      events: video.eventCount,
    }));
    res.json(
      GetVisionDashboardResponse.parse({
        videosAnalyzed: videos.filter((video) => video.status === "analyzed").length,
        peopleDetected: videos.reduce((sum, video) => sum + video.peopleCount, 0),
        uniqueTracks: Math.round(videos.reduce((sum, video) => sum + video.peopleCount, 0) * 0.74),
        totalEvents: events.length,
        unusualEvents: unusual.length,
        criticalAlerts: alerts.filter((alert) => alert.status === "active" && alert.severity === "critical").length,
        importantClips: unusual.length,
        confidence: events.length
          ? Number((events.reduce((sum, event) => sum + event.confidence, 0) / events.length).toFixed(2))
          : 0,
        activity: [
          { time: "06:00", value: 2 },
          { time: "08:00", value: 5 },
          { time: "10:00", value: 8 },
          { time: "12:00", value: 6 },
          { time: "14:00", value: 10 },
          { time: "16:00", value: 7 },
          { time: "18:00", value: 4 },
          { time: "20:00", value: 2 },
        ],
        recentEvents: events.slice(0, 5),
        cameras,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to load VisionGuard dashboard");
    res.status(500).json({ error: "Dashboard data could not be loaded." });
  }
});

router.get("/videos", async (req, res) => {
  const userId = authenticatedUser(req, res);
  if (!userId) return;
  try {
    await ensureDemoData(userId);
    const videos = await db
      .select()
      .from(videosTable)
      .where(eq(videosTable.userId, userId))
      .orderBy(desc(videosTable.uploadedAt));
    res.json(GetVideosResponse.parse(videos));
  } catch (error) {
    req.log.error({ err: error }, "Failed to load videos");
    res.status(500).json({ error: "Video library could not be loaded." });
  }
});

router.post("/videos", async (req, res) => {
  const userId = authenticatedUser(req, res);
  if (!userId) return;
  const parsed = CreateVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Video details are incomplete." });
    return;
  }
  if (!parsed.data.objectPath?.startsWith("/objects/")) {
    res.status(400).json({ error: "A privately uploaded video object is required." });
    return;
  }
  try {
    const [video] = await db
      .insert(videosTable)
      .values({
        userId,
        name: parsed.data.name,
        camera: parsed.data.camera,
        location: parsed.data.location,
        fileSizeBytes: parsed.data.fileSizeBytes,
        objectPath: parsed.data.objectPath,
        status: "attention",
        source: "upload",
        summary: "File is stored privately. Automated video analysis is not connected yet.",
      })
      .returning();
    res.status(201).json(CreateVideoResponse.parse(video));
  } catch (error) {
    req.log.error({ err: error }, "Failed to register uploaded video");
    res.status(500).json({ error: "Video metadata could not be saved." });
  }
});

router.get("/events", async (req, res) => {
  const userId = authenticatedUser(req, res);
  if (!userId) return;
  try {
    await ensureDemoData(userId);
    res.json(GetEventsResponse.parse(await getOwnedEvents(userId)));
  } catch (error) {
    req.log.error({ err: error }, "Failed to load events");
    res.status(500).json({ error: "Events could not be loaded." });
  }
});

router.patch("/events/:eventId/review", async (req, res) => {
  const userId = authenticatedUser(req, res);
  if (!userId) return;
  const params = ReviewEventParams.safeParse(req.params);
  const body = ReviewEventBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Review status is invalid." });
    return;
  }
  try {
    const [event] = await db
      .update(eventsTable)
      .set({ reviewStatus: body.data.reviewStatus })
      .where(and(eq(eventsTable.id, params.data.eventId), eq(eventsTable.userId, userId)))
      .returning();
    if (!event) {
      res.status(404).json({ error: "Event not found." });
      return;
    }
    res.json(ReviewEventResponse.parse(event));
  } catch (error) {
    req.log.error({ err: error }, "Failed to update event review");
    res.status(500).json({ error: "Event review could not be saved." });
  }
});

router.get("/investigations", async (req, res) => {
  const userId = authenticatedUser(req, res);
  if (!userId) return;
  try {
    await ensureDemoData(userId);
    const items = await db
      .select()
      .from(investigationsTable)
      .where(eq(investigationsTable.userId, userId))
      .orderBy(desc(investigationsTable.createdAt));
    res.json(GetInvestigationsResponse.parse(items));
  } catch (error) {
    req.log.error({ err: error }, "Failed to load investigations");
    res.status(500).json({ error: "Investigations could not be loaded." });
  }
});

router.post("/investigations", async (req, res) => {
  const userId = authenticatedUser(req, res);
  if (!userId) return;
  const parsed = CreateInvestigationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Investigation details are invalid." });
    return;
  }
  try {
    const requestedIds = parsed.data.eventIds ?? [];
    const owned = requestedIds.length
      ? await db.select({ id: eventsTable.id }).from(eventsTable).where(and(eq(eventsTable.userId, userId)))
      : [];
    const allowedIds = new Set(owned.map((event) => event.id));
    const [item] = await db
      .insert(investigationsTable)
      .values({
        userId,
        title: parsed.data.title,
        severity: parsed.data.severity,
        eventIds: requestedIds.filter((id) => allowedIds.has(id)),
        notes: parsed.data.notes ?? "",
      })
      .returning();
    res.status(201).json(CreateInvestigationResponse.parse(item));
  } catch (error) {
    req.log.error({ err: error }, "Failed to create investigation");
    res.status(500).json({ error: "Investigation could not be created." });
  }
});

router.get("/alerts", async (req, res) => {
  const userId = authenticatedUser(req, res);
  if (!userId) return;
  try {
    await ensureDemoData(userId);
    const items = await db
      .select()
      .from(alertsTable)
      .where(eq(alertsTable.userId, userId))
      .orderBy(desc(alertsTable.createdAt));
    res.json(GetAlertsResponse.parse(items));
  } catch (error) {
    req.log.error({ err: error }, "Failed to load alert rules");
    res.status(500).json({ error: "Alert rules could not be loaded." });
  }
});

router.post("/alerts", async (req, res) => {
  const userId = authenticatedUser(req, res);
  if (!userId) return;
  const parsed = CreateAlertBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Alert rule details are invalid." });
    return;
  }
  try {
    const [item] = await db
      .insert(alertsTable)
      .values({ ...parsed.data, userId })
      .returning();
    res.status(201).json(CreateAlertResponse.parse(item));
  } catch (error) {
    req.log.error({ err: error }, "Failed to create alert rule");
    res.status(500).json({ error: "Alert rule could not be created." });
  }
});

router.patch("/alerts/:alertId/status", async (req, res) => {
  const userId = authenticatedUser(req, res);
  if (!userId) return;
  const params = UpdateAlertStatusParams.safeParse(req.params);
  const body = UpdateAlertStatusBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Alert status is invalid." });
    return;
  }
  try {
    const [item] = await db
      .update(alertsTable)
      .set({ status: body.data.status })
      .where(and(eq(alertsTable.id, params.data.alertId), eq(alertsTable.userId, userId)))
      .returning();
    if (!item) {
      res.status(404).json({ error: "Alert rule not found." });
      return;
    }
    res.json(UpdateAlertStatusResponse.parse(item));
  } catch (error) {
    req.log.error({ err: error }, "Failed to update alert status");
    res.status(500).json({ error: "Alert status could not be changed." });
  }
});

router.post("/search", async (req, res) => {
  const userId = authenticatedUser(req, res);
  if (!userId) return;
  const parsed = SearchEvidenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Search query is required." });
    return;
  }
  try {
    await ensureDemoData(userId);
    const events = await getOwnedEvents(userId, parsed.data.videoId);
    res.json(SearchEvidenceResponse.parse(matchQuery(events, parsed.data.query)));
  } catch (error) {
    req.log.error({ err: error }, "Evidence search failed");
    res.status(500).json({ error: "Evidence search could not be completed." });
  }
});

router.post("/ask-ai", async (req, res) => {
  const userId = authenticatedUser(req, res);
  if (!userId) return;
  const parsed = AskAboutEvidenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A question is required." });
    return;
  }
  try {
    await ensureDemoData(userId);
    const events = await getOwnedEvents(userId, parsed.data.videoId);
    const evidence = matchQuery(events, parsed.data.question).slice(0, 5);
    const meanConfidence = evidence.length
      ? evidence.reduce((sum, event) => sum + event.confidence, 0) / evidence.length
      : 0;
    const answer = evidence.length
      ? `The indexed evidence contains ${evidence.length} matching event record${evidence.length === 1 ? "" : "s"}. These are sample analysis records and should be verified against the original footage.`
      : "No matching indexed event evidence was found. This does not establish that the activity did not occur; review the footage directly.";
    res.json(
      AskAboutEvidenceResponse.parse({
        answer,
        evidence,
        confidence: Number(meanConfidence.toFixed(2)),
        grounded: evidence.length > 0,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Evidence question failed");
    res.status(500).json({ error: "The question could not be answered from indexed evidence." });
  }
});

router.get("/reports", async (req, res) => {
  const userId = authenticatedUser(req, res);
  if (!userId) return;
  try {
    await ensureDemoData(userId);
    const items = await db
      .select()
      .from(reportsTable)
      .where(eq(reportsTable.userId, userId))
      .orderBy(desc(reportsTable.createdAt));
    res.json(GetReportsResponse.parse(items));
  } catch (error) {
    req.log.error({ err: error }, "Failed to load reports");
    res.status(500).json({ error: "Reports could not be loaded." });
  }
});

router.post("/reports", async (req, res) => {
  const userId = authenticatedUser(req, res);
  if (!userId) return;
  const parsed = CreateReportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a video before generating a report." });
    return;
  }
  try {
    const [video] = await db
      .select()
      .from(videosTable)
      .where(and(eq(videosTable.id, parsed.data.videoId), eq(videosTable.userId, userId)));
    if (!video) {
      res.status(404).json({ error: "Video not found." });
      return;
    }
    const events = await getOwnedEvents(userId, video.id);
    const summary = events.length
      ? `Sample report for ${video.name}: ${events.length} indexed event records, including ${events.filter((event) => ["warning", "suspicious", "critical"].includes(event.severity)).length} items for human review.`
      : `No indexed event records are available for ${video.name}.`;
    const [item] = await db
      .insert(reportsTable)
      .values({
        userId,
        title: `${video.camera} · Incident report`,
        videoId: video.id,
        severity: video.riskLevel,
        summary,
        status: "ready",
      })
      .returning();
    res.status(201).json(CreateReportResponse.parse(item));
  } catch (error) {
    req.log.error({ err: error }, "Failed to create report");
    res.status(500).json({ error: "Report could not be generated." });
  }
});

export default router;
