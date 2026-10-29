"use client";

import { useState } from "react";
import {
	Card,
	CardContent,
	CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Download, Plus, PlugZap, Trash2, Search, Brain, Eye, ScrollText } from "lucide-react";
import { API_TYPES, fetchModels, testProvider, type Model, type Provider } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import type { Translate } from "@/i18n/locale";

type FormState = {
	name: string;
	baseUrl: string;
	api: string;
	apiKey: string;
	headers: string;
	compat: string;
	models: Model[];
};

function parseJson(value: string, label: string, t: Translate): any | undefined {
	const v = value.trim();
	if (!v) return undefined;
	try {
		return JSON.parse(v);
	} catch (e) {
		toast.error(t("editor.jsonInvalid", { label, message: String((e as Error)?.message || e) }));
		throw e;
	}
}

/**
 * Server errors arrive as an English `error` string plus, for the cases the UI
 * can translate, a stable `code`. Fall back to the raw message otherwise (it is
 * usually an upstream HTTP body fragment, which must stay verbatim).
 */
function serverMessage(
	res: { error?: string; code?: string },
	t: Translate
): string {
	switch (res.code) {
		case "BASE_URL_REQUIRED":
			return t("editor.serverBaseUrlRequired");
		case "REQUEST_FAILED":
			return t("editor.serverRequestFailed");
		case "CONNECTION_FAILED":
			return t("editor.serverConnectionFailed");
		default:
			return res.error || "";
	}
}

export function ProviderEditor({
	name,
	provider,
	onSave,
}: {
	name: string;
	provider: Provider;
	onSave: (edited: Provider) => void;
}) {
	const { t } = useI18n();
	const [form, setForm] = useState<FormState>(() => ({
		name: provider.name || "",
		baseUrl: provider.baseUrl || "",
		api: provider.api || "openai-completions",
		apiKey: "",
		headers: JSON.stringify(provider.headers ?? {}, null, 2),
		compat: JSON.stringify(provider.compat ?? {}, null, 2),
		models: provider.models ?? [],
	}));
	const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

	/* 从供应商 /models 接口拉取模型并选择添加 */
	const [fetchOpen, setFetchOpen] = useState(false);
	const [fetchLoading, setFetchLoading] = useState(false);
	const [remoteModels, setRemoteModels] = useState<Model[]>([]);
	const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
	const [searchQuery, setSearchQuery] = useState("");

	/* 调试日志 dialog */
	const [logOpen, setLogOpen] = useState(false);
	const [logContent, setLogContent] = useState("");
	const [logLoading, setLogLoading] = useState(false);

	async function openLog() {
		setLogOpen(true);
		setLogLoading(true);
		try {
			const r = await fetch("/api/log");
			const j = await r.json();
			setLogContent(j.content || t("editor.logEmpty"));
		} catch (e) {
			setLogContent(t("editor.logReadFailed", { message: String((e as Error)?.message || e) }));
		} finally {
			setLogLoading(false);
		}
	}

	async function handleFetch() {
		const baseUrl = form.baseUrl.trim();
		if (!baseUrl) {
			toast.error(t("editor.baseUrlRequired"));
			return;
		}
		let headers: any;
		try {
			headers = parseJson(form.headers, "headers", t);
		} catch {
			return;
		}
		setFetchOpen(true);
		setFetchLoading(true);
		setSearchQuery("");
		try {
			const j = await fetchModels({
				provider: name,
				baseUrl,
				api: form.api,
				apiKey: form.apiKey,
				headers,
			});
			if (!j.ok) {
				const reason = serverMessage(j, t);
				throw new Error(
					reason +
						(j.attempts?.length
							? "\n" + t("editor.attemptsHeader") + "\n" + j.attempts.join("\n")
							: "")
				);
			}
			const models = j.models || [];
			setRemoteModels(models);
			const existing = new Set(form.models.map((m) => m.id));
			const fresh = models.filter((m) => !existing.has(m.id)).map((m) => m.id);
			setCheckedIds(new Set(fresh.length > 0 ? fresh : models.map((m) => m.id)));
		} catch (e) {
			toast.error(t("editor.fetchFailed", { message: String((e as Error)?.message || e) }));
			setFetchOpen(false);
		} finally {
			setFetchLoading(false);
		}
	}

	function applyChecked() {
		const existingMap = new Map(form.models.map((m) => [m.id, m]));
		const remoteMap = new Map(remoteModels.map((m) => [m.id, m]));
		const updatedModels = [...form.models];
		let addedCount = 0;
		let updatedCount = 0;

		for (const id of checkedIds) {
			const remote = remoteMap.get(id);
			if (!remote) continue;
			const existing = existingMap.get(id);
			if (existing) {
				const idx = updatedModels.findIndex((m) => m.id === id);
				if (idx !== -1) {
					updatedModels[idx] = {
						...remote,
						...existing,
						name: existing.name || remote.name,
						reasoning: existing.reasoning !== undefined ? existing.reasoning : remote.reasoning,
						input: existing.input && existing.input.length > 0 ? existing.input : remote.input,
						contextWindow: existing.contextWindow || remote.contextWindow,
						maxTokens: existing.maxTokens || remote.maxTokens,
					};
					updatedCount++;
				}
			} else {
				updatedModels.push({ ...remote });
				addedCount++;
			}
		}

		set({ models: updatedModels });
		setFetchOpen(false);
		const msgs: string[] = [];
		if (addedCount > 0) msgs.push(t("editor.importAdded", { count: addedCount }));
		if (updatedCount > 0) msgs.push(t("editor.importUpdated", { count: updatedCount }));
		toast.success(t("editor.imported", { summary: msgs.join(t("editor.importJoiner")) }));
	}

	function handleTest() {
		const baseUrl = form.baseUrl.trim();
		if (!baseUrl) {
			toast.error(t("editor.baseUrlRequired"));
			return;
		}
		let headers: any;
		try {
			headers = parseJson(form.headers, "headers", t);
		} catch {
			return;
		}
		testProvider({
			provider: name,
			baseUrl,
			api: form.api,
			apiKey: form.apiKey,
			headers,
		})
			.then((j) => {
				if (j.ok) {
					toast.success(
						t("editor.connectionOk", {
							status: j.status ?? "200",
							body: j.body ? " — " + j.body.slice(0, 120) : "",
						})
					);
				} else {
					toast.error(
						t("editor.connectionFailed", {
							message: serverMessage(j, t) || "HTTP " + j.status,
						})
					);
				}
			})
			.catch((e) =>
				toast.error(t("editor.connectionFailed", { message: String((e as Error)?.message || e) }))
			);
	}

	function setModel(i: number, patch: Partial<Model>) {
		set({ models: form.models.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) });
	}
	function addModel() {
		set({ models: [...form.models, { id: "" }] });
	}
	function delModel(i: number) {
		set({ models: form.models.filter((_, idx) => idx !== i) });
	}
	function toggleInput(i: number, key: "text" | "image") {
		const m = form.models[i];
		const has = (m.input || []).includes(key);
		const input = has ? (m.input || []).filter((k) => k !== key) : [...(m.input || []), key];
		setModel(i, { input });
	}

	function handleSave() {
		let headers: any, compat: any;
		try {
			headers = parseJson(form.headers, "headers", t);
			compat = parseJson(form.compat, "compat", t);
		} catch {
			return;
		}
		onSave({
			baseUrl: form.baseUrl.trim(),
			name: form.name.trim() || undefined,
			api: form.api,
			headers,
			compat,
			apiKey: form.apiKey,
			models: form.models.filter((m) => m.id.trim()),
		});
		set({ apiKey: "" });
	}

	return (
		<Card className="flex min-h-0 flex-1 flex-col rounded-none bg-transparent ring-0">
			<CardContent className="flex min-h-0 flex-1 flex-col gap-4">
				<div className="grid gap-4 md:grid-cols-2">
					<div className="space-y-2">
						<Label>{t("editor.displayName")}</Label>
						<Input
							value={form.name}
							onChange={(e) => set({ name: e.target.value })}
							placeholder="DeepSeek"
						/>
					</div>
					<div className="space-y-2">
						<Label>{t("editor.apiType")}</Label>
						<Select value={form.api} onValueChange={(v) => set({ api: v })}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{API_TYPES.map((a) => (
									<SelectItem key={a} value={a}>
										{a}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<Label>Base URL</Label>
						<Input
							value={form.baseUrl}
							onChange={(e) => set({ baseUrl: e.target.value })}
							placeholder="https://api.example.com/v1"
						/>
					</div>
					<div className="space-y-2">
						<Label>{t("editor.apiKey")}</Label>
						<Input
							type="password"
							value={form.apiKey}
							onChange={(e) => set({ apiKey: e.target.value })}
							placeholder={
								provider.apiKey ? t("editor.apiKeyConfigured") : t("editor.apiKeyPlaceholder")
							}
						/>
					</div>
					<div className="space-y-2">
						<Label>{t("editor.headers")}</Label>
						<Textarea
							value={form.headers}
							onChange={(e) => set({ headers: e.target.value })}
							rows={4}
							placeholder="{}"
							className="font-mono text-xs"
						/>
					</div>
					<div className="space-y-2">
						<Label>{t("editor.compat")}</Label>
						<Textarea
							value={form.compat}
							onChange={(e) => set({ compat: e.target.value })}
							rows={4}
							placeholder="{}"
							className="font-mono text-xs"
						/>
					</div>
				</div>

				<div className="flex min-h-0 flex-1 flex-col gap-2">
					<div className="flex items-center justify-between">
						<Label>{t("editor.models")}</Label>
						<div className="flex gap-2">
							<Button size="sm" variant="outline" onClick={handleFetch}>
								<Download className="size-4" />
								{t("editor.fetchModels")}
							</Button>
							<Button size="sm" variant="ghost" onClick={openLog} title={t("editor.viewLog")}>
								<ScrollText className="size-4" />
							</Button>
							<Button size="sm" variant="outline" onClick={addModel}>
								<Plus className="size-4" />
								{t("editor.addModel")}
							</Button>
						</div>
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="min-w-36">{t("editor.colId")}</TableHead>
									<TableHead>{t("editor.colName")}</TableHead>
									<TableHead title={t("editor.colReasoningTitle")} className="w-12 text-center">
										{t("editor.colReasoning")}
									</TableHead>
									<TableHead className="w-12 text-center">{t("editor.colText")}</TableHead>
									<TableHead className="w-12 text-center">{t("editor.colImage")}</TableHead>
									<TableHead>{t("editor.colContext")}</TableHead>
									<TableHead>{t("editor.colMaxTokens")}</TableHead>
									<TableHead className="w-10" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{form.models.map((m, i) => (
									<TableRow key={i}>
										<TableCell>
											<Input
												className="h-8 min-w-36"
												value={m.id || ""}
												onChange={(e) => setModel(i, { id: e.target.value })}
												placeholder="model-id"
											/>
										</TableCell>
										<TableCell>
											<Input
												className="h-8"
												value={m.name || ""}
												onChange={(e) => setModel(i, { name: e.target.value })}
												placeholder={t("editor.modelNamePlaceholder")}
											/>
										</TableCell>
										<TableCell className="text-center">
											<Switch
												checked={!!m.reasoning}
												onCheckedChange={(v) => setModel(i, { reasoning: v })}
											/>
										</TableCell>
										<TableCell className="text-center">
											<Switch
												checked={(m.input || []).includes("text")}
												onCheckedChange={() => toggleInput(i, "text")}
											/>
										</TableCell>
										<TableCell className="text-center">
											<Switch
												checked={(m.input || []).includes("image")}
												onCheckedChange={() => toggleInput(i, "image")}
											/>
										</TableCell>
										<TableCell>
											<Input
												type="number"
												className="h-8 w-24"
												value={m.contextWindow ?? ""}
												onChange={(e) =>
													setModel(i, {
														contextWindow: e.target.value
															? +e.target.value
															: undefined,
													})
												}
												placeholder="0"
											/>
										</TableCell>
										<TableCell>
											<Input
												type="number"
												className="h-8 w-24"
												value={m.maxTokens ?? ""}
												onChange={(e) =>
													setModel(i, {
														maxTokens: e.target.value ? +e.target.value : undefined,
													})
												}
												placeholder="0"
											/>
										</TableCell>
										<TableCell>
											<Button
												size="icon"
												variant="ghost"
												onClick={() => delModel(i)}
											>
												<Trash2 className="size-4" />
											</Button>
										</TableCell>
									</TableRow>
								))}
								{form.models.length === 0 && (
									<TableRow>
										<TableCell
											colSpan={8}
											className="py-6 text-center text-sm text-muted-foreground"
										>
											{t("editor.emptyModels")}
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
				</div>
			</CardContent>
			<CardFooter className="justify-end gap-2 rounded-none border-t-0 bg-transparent">
				<Button variant="outline" onClick={handleTest}>
					<PlugZap className="size-4" />
					{t("editor.test")}
				</Button>
				<Button onClick={handleSave}>{t("editor.save")}</Button>
			</CardFooter>

			<Dialog open={fetchOpen} onOpenChange={(o) => !fetchLoading && setFetchOpen(o)}>
				<DialogContent className="sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>{t("editor.fetchDialogTitle")}</DialogTitle>
						<DialogDescription>{t("editor.fetchDialogDescription")}</DialogDescription>
					</DialogHeader>

					{fetchLoading ? (
						<div className="py-12 text-center text-sm text-muted-foreground">
							{t("editor.fetching")}
						</div>
					) : remoteModels.length === 0 ? (
						<div className="py-12 text-center text-sm text-muted-foreground">
							{t("editor.fetchEmpty")}
						</div>
					) : (
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<div className="relative flex-1">
									<Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
									<Input
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										placeholder={t("editor.searchPlaceholder")}
										className="pl-8 text-sm"
									/>
								</div>
								<Button
									size="sm"
									variant="outline"
									onClick={() => {
										const q = searchQuery.trim().toLowerCase();
										const matching = remoteModels
											.filter((m) => !q || m.id.toLowerCase().includes(q) || (m.name && m.name.toLowerCase().includes(q)))
											.map((m) => m.id);
										setCheckedIds((prev) => new Set([...prev, ...matching]));
									}}
								>
									{t("editor.selectAll")}
								</Button>
								<Button
									size="sm"
									variant="outline"
									onClick={() => {
										const q = searchQuery.trim().toLowerCase();
										const matchingSet = new Set(
											remoteModels
												.filter((m) => !q || m.id.toLowerCase().includes(q) || (m.name && m.name.toLowerCase().includes(q)))
												.map((m) => m.id)
										);
										setCheckedIds((prev) => {
											const next = new Set(prev);
											for (const id of matchingSet) next.delete(id);
											return next;
										});
									}}
								>
									{t("editor.selectNone")}
								</Button>
							</div>

							<div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
								{remoteModels
									.filter((m) => {
										const q = searchQuery.trim().toLowerCase();
										if (!q) return true;
										return m.id.toLowerCase().includes(q) || (m.name && m.name.toLowerCase().includes(q));
									})
									.map((m) => {
										const isExisting = form.models.some((item) => item.id === m.id);
										const isChecked = checkedIds.has(m.id);
										return (
											<label
												key={m.id}
												className={cn(
													"flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-2.5 text-sm transition-colors hover:bg-accent/40",
													isChecked && "border-primary/50 bg-accent/20"
												)}
											>
												<div className="flex min-w-0 items-center gap-2.5">
													<input
														type="checkbox"
														checked={isChecked}
														onChange={() =>
															setCheckedIds((prev) => {
																const next = new Set(prev);
																if (next.has(m.id)) next.delete(m.id);
																else next.add(m.id);
																return next;
															})
														}
														className="size-4 rounded accent-primary"
													/>
													<div className="min-w-0 space-y-0.5">
														<div className="flex items-center gap-2">
															<span className="font-mono text-sm font-medium leading-none">
																{m.id}
															</span>
															{isExisting && (
																<Badge variant="outline" className="text-[10px] text-muted-foreground">
																	{t("editor.alreadyInList")}
																</Badge>
															)}
														</div>
														{m.name && m.name !== m.id && (
															<div className="truncate text-xs text-muted-foreground">
																{m.name}
															</div>
														)}
													</div>
												</div>
												<div className="flex shrink-0 items-center gap-1.5">
													{m.reasoning && (
														<Badge variant="secondary" className="gap-1 text-[10px]">
															<Brain className="size-3" />
															{t("editor.badgeReasoning")}
														</Badge>
													)}
													{m.input?.includes("image") && (
														<Badge variant="secondary" className="gap-1 text-[10px]">
															<Eye className="size-3" />
															{t("editor.badgeVision")}
														</Badge>
													)}
													{m.contextWindow ? (
														<Badge variant="outline" className="text-[10px] font-mono">
															{m.contextWindow >= 1000
																? `${Math.round(m.contextWindow / 1000)}k`
																: m.contextWindow}
														</Badge>
													) : null}
												</div>
											</label>
										);
									})}
							</div>
						</div>
					)}

					<DialogFooter className="flex items-center justify-between sm:justify-between">
						<div className="text-xs text-muted-foreground">
							{t("editor.selectedCount", {
								selected: checkedIds.size,
								total: remoteModels.length,
							})}
						</div>
						<div className="flex gap-2">
							<Button variant="outline" onClick={() => setFetchOpen(false)}>
								{t("common.cancel")}
							</Button>
							<Button disabled={checkedIds.size === 0} onClick={applyChecked}>
								{t("editor.importButton", { count: checkedIds.size })}
							</Button>
						</div>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* 调试日志 Dialog */}
			<Dialog open={logOpen} onOpenChange={setLogOpen}>
				<DialogContent className="max-w-3xl">
					<DialogHeader>
						<DialogTitle>{t("editor.logTitle")}</DialogTitle>
					</DialogHeader>
					<pre className="max-h-[60vh] overflow-auto rounded bg-muted p-3 text-xs font-mono whitespace-pre-wrap break-all">
						{logLoading ? t("common.loading") : logContent || t("editor.logEmpty")}
					</pre>
					<DialogFooter>
						<Button variant="outline" onClick={openLog} disabled={logLoading}>
							{t("common.refresh")}
						</Button>
						<Button variant="outline" onClick={() => setLogOpen(false)}>
							{t("common.close")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
