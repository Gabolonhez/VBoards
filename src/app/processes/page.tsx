
"use client";

import { useEffect, useState, useCallback } from "react";
import { getDocs, createDoc, updateDoc, deleteDoc } from "@/lib/api";
import { Doc, DocType } from "@/types";
import { Button } from "@/components/ui/button";
import { FileText, Workflow, Save, Trash, Loader2, Circle, Square, Type, Diamond, X, Pencil } from "lucide-react";
import ReactFlow, {
    addEdge,
    Background,
    Controls,
    MiniMap,
    Panel,
    useNodesState,
    useEdgesState,
    Connection
} from "reactflow";
import "reactflow/dist/style.css";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { ConfirmDialog } from "@/components/modals/confirm-dialog";
import { PromptDialog } from "@/components/modals/prompt-dialog";
import { DiamondNode, TextNode, CircleNode, RectangleNode } from "@/components/flow/custom-nodes";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { useAuth } from "@/context/auth-context";

const nodeTypes = {
    diamond: DiamondNode,
    text: TextNode,
    circle: CircleNode,
    rectangle: RectangleNode,
};

export default function ProcessesPage() {
    const { toast } = useToast();
    const { t } = useLanguage();
    const { organization } = useAuth();
    const [docs, setDocs] = useState<Doc[]>([]);
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
    const [createDocType, setCreateDocType] = useState<DocType | null>(null);
    const [renameDocId, setRenameDocId] = useState<string | null>(null);

    // Editor State
    const [content, setContent] = useState("");
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);



    useEffect(() => {
        const doc = docs.find(d => d.id === selectedDocId);
        if (doc) {
            if (doc.type === 'document') {
                setContent(doc.content || "");
            } else {
                if (doc.flowDiagramJson) {
                    setNodes(doc.flowDiagramJson.nodes || []);
                    setEdges(doc.flowDiagramJson.edges || []);
                } else {
                    setNodes([]);
                    setEdges([]);
                }
            }
        }
    }, [selectedDocId, docs, setNodes, setEdges]);

    const fetchDocs = useCallback(async () => {
        if (!organization) {
            setLoading(false);
            return;
        }
        try {
            const data = await getDocs(organization.id);
            setDocs(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [organization]);

    useEffect(() => {
        fetchDocs();
    }, [organization, fetchDocs]);

    async function handleCreate(type: DocType) {
        setCreateDocType(type);
    }

    async function confirmCreate(title: string) {
        if (!createDocType || !organization) return;
        try {
            const newDoc = await createDoc({
                title,
                type: createDocType,
                content: "",
                flowDiagramJson: { nodes: [], edges: [] }
            }, organization.id);
            setDocs([newDoc, ...docs]);
            setSelectedDocId(newDoc.id);
            toast({ title: t('common.success'), description: t('processes.created') });
        } catch {
            toast({ title: t('common.error'), description: t('processes.create_error'), variant: "destructive" });
        } finally {
            setCreateDocType(null);
        }
    }

    async function handleSave() {
        if (!selectedDocId) return;
        const doc = docs.find(d => d.id === selectedDocId);
        if (!doc) return;

        setSaving(true);
        try {
            if (doc.type === 'document') {
                await updateDoc(doc.id, { content });
                // Update local state
                setDocs(docs.map(d => d.id === doc.id ? { ...d, content } : d));
            } else {
                const flowData = { nodes, edges };
                await updateDoc(doc.id, { flowDiagramJson: flowData });
                setDocs(docs.map(d => d.id === doc.id ? { ...d, flowDiagramJson: flowData } : d));
            }
            toast({ title: t('common.success'), description: t('processes.saved') });
        } catch {
            toast({ title: t('common.error'), description: t('processes.save_error'), variant: "destructive" });
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        setDeleteDocId(id);
    }

    async function handleRename(id: string) {
        setRenameDocId(id);
    }

    async function confirmRename(newTitle: string) {
        if (!renameDocId) return;
        try {
            await updateDoc(renameDocId, { title: newTitle });
            setDocs(docs.map(d => d.id === renameDocId ? { ...d, title: newTitle } : d));
            toast({ title: t('common.success'), description: t('processes.renamed_success') });
        } catch {
            toast({ title: t('common.error'), description: t('processes.rename_error'), variant: "destructive" });
        } finally {
            setRenameDocId(null);
        }
    }

    const [editNodeId, setEditNodeId] = useState<string | null>(null);

    const addNode = (type: 'rectangle' | 'circle' | 'diamond' | 'text') => {
        const id = `${type}-${Date.now()}`;
        const label = type === 'text' ? 'Text' : type.charAt(0).toUpperCase() + type.slice(1);
        const newNode = {
            id,
            type, // Use our custom types
            position: { x: 100 + Math.random() * 50, y: 100 + Math.random() * 50 },
            data: { label },
        };
        setNodes((nds) => nds.concat(newNode));
    };

    const onDeleteNode = useCallback(() => {
        setNodes((nds) => nds.filter((node) => !node.selected));
        setEdges((eds) => eds.filter((edge) => !edge.selected));
    }, [setNodes, setEdges]);

    // Handle Delete Key
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Delete' || event.key === 'Backspace') {
                if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                    onDeleteNode();
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onDeleteNode]);

    const onNodeDoubleClick = (_: React.MouseEvent, node: { id: string }) => {
        setEditNodeId(node.id);
    };

    const handleRenameNode = (newLabel: string) => {
        if (!editNodeId) return;
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === editNodeId) {
                    return { ...node, data: { ...node.data, label: newLabel } };
                }
                return node;
            })
        );
        setEditNodeId(null);
    };

    async function confirmDelete() {
        if (!deleteDocId) return;
        try {
            await deleteDoc(deleteDocId);
            setDocs(docs.filter(d => d.id !== deleteDocId));
            if (selectedDocId === deleteDocId) setSelectedDocId(null);
            toast({ title: t('common.success'), description: t('processes.deleted') });
        } catch {
            toast({ title: t('common.error'), description: t('processes.delete_error'), variant: "destructive" });
        } finally {
            setDeleteDocId(null);
        }
    }

    const onConnect = useCallback((params: Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;

    const selectedDoc = docs.find(d => d.id === selectedDocId);

    return (
        <div className="flex h-full bg-background overflow-hidden relative">
            {/* Sidebar */}
            <div className="w-64 border-r bg-card flex flex-col">
                <div className="p-4 border-b space-y-2">
                    <h2 className="font-semibold">{t('processes.title_main')}</h2>
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => handleCreate('document')}>
                            <FileText className="h-4 w-4 mr-1" /> {t('processes.doc_btn')}
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => handleCreate('process')}>
                            <Workflow className="h-4 w-4 mr-1" /> {t('processes.flow_btn')}
                        </Button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {docs.map(doc => (
                        <div
                            key={doc.id}
                            onClick={() => setSelectedDocId(doc.id)}
                            className={cn(
                                "group flex items-center justify-between px-3 py-2 text-sm rounded-md cursor-pointer hover:bg-muted transition-colors",
                                selectedDocId === doc.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                            )}
                        >
                            <div className="flex items-center gap-2 truncate">
                                {doc.type === 'process' ? <Workflow className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                <span className="truncate">{doc.title}</span>
                            </div>
                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => { e.stopPropagation(); handleRename(doc.id); }}
                                    title="Rename"
                                >
                                    <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                                    title="Delete"
                                >
                                    <Trash className="h-3 w-3 text-destructive" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex flex-col bg-background relative">
                {selectedDoc ? (
                    <>
                        <header className="h-14 border-b flex items-center justify-between px-6 bg-card/50">
                            <div className="flex items-center gap-2">
                                {selectedDoc.type === 'process' ? <Workflow className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                                <span className="font-medium">{selectedDoc.title}</span>
                            </div>
                            <Button size="sm" onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                {t('common.save')}
                            </Button>
                        </header>
                        <div className="flex-1 overflow-hidden relative">
                            {selectedDoc.type === 'document' ? (
                                <div className="h-full w-full p-4">
                                    <RichTextEditor
                                        content={content}
                                        onChange={setContent}
                                    />
                                </div>
                            ) : (
                                <div className="h-full w-full">
                                    <ReactFlow
                                        nodes={nodes}
                                        edges={edges}
                                        onNodesChange={onNodesChange}
                                        onEdgesChange={onEdgesChange}
                                        onConnect={onConnect}
                                        onNodeDoubleClick={onNodeDoubleClick}
                                        nodeTypes={nodeTypes}
                                        fitView
                                        deleteKeyCode={['Backspace', 'Delete']}
                                    >
                                        <Background />
                                        <Controls />
                                        <MiniMap />
                                        <Panel position="top-right" className="flex flex-col gap-2 bg-background/90 p-2 rounded-lg border shadow-sm backdrop-blur">
                                            <div className="flex gap-1">
                                                <Button size="icon" variant="ghost" onClick={() => addNode('rectangle')} title="Rectangle">
                                                    <Square className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" onClick={() => addNode('circle')} title="Circle">
                                                    <Circle className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" onClick={() => addNode('diamond')} title="Diamond">
                                                    <Diamond className="h-4 w-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" onClick={() => addNode('text')} title="Text">
                                                    <Type className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <div className="h-px bg-border my-1" />
                                            <Button size="icon" variant="ghost" onClick={onDeleteNode} title="Delete Selected" className="text-destructive hover:text-destructive">
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </Panel>
                                    </ReactFlow>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                        <FileText className="h-12 w-12 mb-4 opacity-20" />
                        <p>{t('processes.select_doc_desc')}</p>
                    </div>
                )}
            </div>


            <ConfirmDialog
                isOpen={!!deleteDocId}
                onClose={() => setDeleteDocId(null)}
                onConfirm={confirmDelete}
                title={t('common.delete_title')}
                description={t('common.delete_desc')}
                confirmText={t('common.delete')}
                cancelText={t('common.cancel')}
                variant="destructive"
            />

            <PromptDialog
                isOpen={!!createDocType}
                onClose={() => setCreateDocType(null)}
                onConfirm={confirmCreate}
                title={t('processes.new_doc_title')}
                description={t('processes.enter_title')}
                placeholder={t('processes.doc_title')}
                confirmText={t('common.create')}
                cancelText={t('common.cancel')}
            />

            <PromptDialog
                isOpen={!!renameDocId}
                onClose={() => setRenameDocId(null)}
                onConfirm={confirmRename}
                title={t('processes.rename_doc_title')}
                description={t('processes.rename_doc_desc')}
                placeholder={t('processes.rename_doc_placeholder')}
                defaultValue={docs.find(d => d.id === renameDocId)?.title}
                confirmText={t('common.save')}
                cancelText={t('common.cancel')}
            />

            <PromptDialog
                isOpen={!!editNodeId}
                onClose={() => setEditNodeId(null)}
                onConfirm={handleRenameNode}
                title={t('processes.rename_node_title')}
                description={t('processes.rename_node_desc')}
                placeholder={t('processes.rename_node_placeholder')}
                defaultValue={nodes.find(n => n.id === editNodeId)?.data.label}
                confirmText={t('common.save')}
                cancelText={t('common.cancel')}
            />
        </div >
    );
}
