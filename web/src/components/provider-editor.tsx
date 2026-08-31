"use client";

import { useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
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
import { Plus, PlugZap, Trash2 } from "lucide-react";
import { API_TYPES, type Model, type Provider } from "@/lib/api";
import { toast } from "sonner";

type FormState = {
	name: string;
	baseUrl: string;
	api: string;
	apiKey: string;
	headers: string;
	compat: string;
	models: Model[];
};

function parseJson(value: string, label: string): any | undefined {
	const v = value.trim();
	if (!v) return undefined;
	try {
		return JSON.parse(v);
	} catch (e) {
		toast.error(label + " 不是合法 JSON: " + ((e as Error)?.message || e));
		throw e;
	}
}

export function ProviderEditor({
	name,
	provider,
	onSave,
	onTest,
}: {
	name: string;
	provider: Provider;
	onSave: (edited: Provider) => void;
	onTest: () => void;
}) {
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
			headers = parseJson(form.headers, "headers");
			compat = parseJson(form.compat, "compat");
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
		<Card>
			<CardHeader>
				<CardTitle>{name}</CardTitle>
				<CardDescription>
					ID 为 models.json 的键，保存后写入文件并自动备份。
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-4 md:grid-cols-2">
					<div className="space-y-2">
						<Label>显示名称</Label>
						<Input
							value={form.name}
							onChange={(e) => set({ name: e.target.value })}
							placeholder="DeepSeek"
						/>
					</div>
					<div className="space-y-2">
						<Label>API 类型</Label>
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
						<Label>API Key（留空保留原值，输入则覆盖）</Label>
						<Input
							type="password"
							value={form.apiKey}
							onChange={(e) => set({ apiKey: e.target.value })}
							placeholder={
								provider.apiKey ? "已配置，留空保留原值" : "输入 API Key"
							}
						/>
					</div>
					<div className="space-y-2">
						<Label>请求头 headers（JSON）</Label>
						<Textarea
							value={form.headers}
							onChange={(e) => set({ headers: e.target.value })}
							rows={4}
							placeholder="{}"
							className="font-mono text-xs"
						/>
					</div>
					<div className="space-y-2">
						<Label>兼容设置 compat（JSON）</Label>
						<Textarea
							value={form.compat}
							onChange={(e) => set({ compat: e.target.value })}
							rows={4}
							placeholder="{}"
							className="font-mono text-xs"
						/>
					</div>
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label>模型列表</Label>
						<Button size="sm" variant="outline" onClick={addModel}>
							<Plus className="size-4" />
							新增模型
						</Button>
					</div>
					<div className="rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="min-w-36">ID</TableHead>
									<TableHead>名称</TableHead>
									<TableHead title="支持推理" className="w-12 text-center">
										思考
									</TableHead>
									<TableHead className="w-12 text-center">文本</TableHead>
									<TableHead className="w-12 text-center">图片</TableHead>
									<TableHead>上下文窗口</TableHead>
									<TableHead>最大输出</TableHead>
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
												placeholder="显示名"
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
											暂无模型，点上方新增
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
				</div>
			</CardContent>
			<CardFooter className="justify-end gap-2">
				<Button variant="outline" onClick={onTest}>
					<PlugZap className="size-4" />
					测试连接
				</Button>
				<Button onClick={handleSave}>保存供应商</Button>
			</CardFooter>
		</Card>
	);
}
