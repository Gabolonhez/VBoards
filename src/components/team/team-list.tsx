"use client";

import { useState, useEffect } from "react";
import { TeamMember } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trash, Search, Shield, Plus, Copy, Check, Pencil } from "lucide-react";
import { ConfirmDialog } from "@/components/modals/confirm-dialog";
import { useLanguage } from "@/context/language-context";
import { deleteMember, inviteMember, updateMember } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";

interface TeamListProps {
    initialMembers: TeamMember[];
    onRefresh?: () => void;
}

export function TeamList({ initialMembers, onRefresh }: TeamListProps) {
    const { organization } = useAuth();
    const [members, setMembers] = useState<TeamMember[]>(initialMembers);
    const [search, setSearch] = useState("");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const { t } = useLanguage();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [copiedToken, setCopiedToken] = useState<string | null>(null);

    const copyInviteLink = (email: string, id: string) => {
        // Invite link points to register page with prefilled email
        const link = `${window.location.origin}/register?email=${encodeURIComponent(email)}`;
        navigator.clipboard.writeText(link);
        setCopiedToken(id);
        toast({ title: t('common.success'), description: "Link copied to clipboard!" });
        setTimeout(() => setCopiedToken(null), 2000);
    };

    // Update members when initialMembers changes (e.g. on organization switch)
    useEffect(() => {
        setMembers(initialMembers);
    }, [initialMembers]);

    // Form state
    const [newEmail, setNewEmail] = useState("");
    const [newRole, setNewRole] = useState("member");

    // Edit state
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
    const [editNickname, setEditNickname] = useState("");
    const [editRole, setEditRole] = useState("member");

    const filteredMembers = members.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.nickname?.toLowerCase().includes(search.toLowerCase()) ||
        m.role?.toLowerCase().includes(search.toLowerCase())
    );

    async function handleAdd() {
        if (!newEmail || !organization) return;
        setLoading(true);
        try {
            await inviteMember(newEmail, newRole, organization.id);
            setIsAddOpen(false);
            setNewEmail("");
            setNewRole("member");
            toast({ title: t('common.success'), description: t('team.invite_sent') });
            onRefresh?.();
        } catch {
            toast({ title: t('common.error'), description: t('team.invite_error'), variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete() {
        if (!deleteId) return;
        try {
            await deleteMember(deleteId);
            setMembers(members.filter(m => m.id !== deleteId));
            toast({ title: t('common.success'), description: t('team.member_removed') });
        } catch {
            toast({ title: t('common.error'), description: t('team.remove_error'), variant: "destructive" });
        } finally {
            setDeleteId(null);
        }
    }

    function openEdit(member: TeamMember) {
        setEditingMember(member);
        setEditNickname(member.nickname || "");
        setEditRole(member.role || "member");
        setIsEditOpen(true);
    }

    async function handleUpdate() {
        if (!editingMember) return;
        setLoading(true);
        try {
            await updateMember(editingMember.id, {
                nickname: editNickname,
                role: editRole
            });

            // Update local state
            setMembers(members.map(m =>
                m.id === editingMember.id
                    ? { ...m, nickname: editNickname, role: editRole }
                    : m
            ));

            setIsEditOpen(false);
            setEditingMember(null);
            toast({ title: t('common.success'), description: t('team.member_updated') });
        } catch {
            toast({ title: t('common.error'), description: t('team.update_error'), variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }

    const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

    return (
        <div className="space-y-8">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">{t('team.title')}</h1>
                <p className="text-muted-foreground">
                    {t('team.subtitle')}
                </p>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
                    <div className="relative w-72">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={t('team.search_placeholder')}
                            className="pl-8"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Button onClick={() => setIsAddOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" /> {t('team.invite_member')}
                    </Button>
                </div>

                <div className="bg-card rounded-lg border shadow-sm">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('team.member')}</TableHead>
                                <TableHead>{t('team.nickname')}</TableHead>
                                <TableHead>{t('team.role')}</TableHead>
                                <TableHead className="text-right">{t('team.actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredMembers.map((member) => (
                                <TableRow key={member.id}>
                                    <TableCell className="flex items-center gap-3">
                                        <Avatar>
                                            <AvatarImage src={member.avatarUrl} />
                                            <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{member.name}</span>
                                            {member.email && <span className="text-xs text-muted-foreground">{member.email}</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {member.invitationId && !member.userId ? (
                                            <span className="inline-flex items-center rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-semibold text-yellow-500">
                                                {t('team.pending')}
                                            </span>
                                        ) : (
                                            member.nickname || "-"
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {member.role && (
                                            <div className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full w-fit">
                                                <Shield className="h-3 w-3" />
                                                {member.role === 'admin' ? t('team.roles.admin') : t('team.roles.member')}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right flex justify-end gap-2">
                                        {member.invitationId && !member.userId && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-primary"
                                                onClick={() => copyInviteLink(member.email!, member.id)}
                                                title={t('team.copy_invite_link') || "Copy Invite Link"}
                                            >
                                                {copiedToken === member.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                        )}

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-muted-foreground hover:text-primary"
                                            onClick={() => openEdit(member)}
                                            title={t('team.edit_member')}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:bg-destructive/10"
                                            onClick={() => setDeleteId(member.id)}
                                        >
                                            <Trash className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredMembers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        {t('team.no_members')}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Custom Dialog for Adding Member */}
                {isAddOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-background border rounded-lg shadow-lg w-full max-w-md p-6 space-y-4">
                            <div className="space-y-2">
                                <h2 className="text-lg font-semibold">{t('team.invite_dialog_title')}</h2>
                                <p className="text-sm text-muted-foreground">{t('team.invite_dialog_desc')}</p>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t('auth.email')}</label>
                                    <Input placeholder={t('team.email_placeholder')} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t('team.role')}</label>
                                    <Select value={newRole} onValueChange={setNewRole}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={t('team.role')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="member">{t('team.roles.member')}</SelectItem>
                                            <SelectItem value="admin">{t('team.roles.admin')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" onClick={() => setIsAddOpen(false)}>{t('common.cancel')}</Button>
                                <Button onClick={handleAdd} disabled={!newEmail || loading}>
                                    {loading ? t('common.loading') : t('team.invite_member')}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Member Dialog */}
                {isEditOpen && editingMember && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-background border rounded-lg shadow-lg w-full max-w-md p-6 space-y-4">
                            <div className="space-y-2">
                                <h2 className="text-lg font-semibold">{t('team.edit_dialog_title')}</h2>
                                <p className="text-sm text-muted-foreground">{t('team.edit_dialog_desc')}</p>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t('team.member')}</label>
                                    <Input value={editingMember.name} disabled className="bg-muted" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t('team.nickname')}</label>
                                    <Input
                                        placeholder={t('team.nickname_optional')}
                                        value={editNickname}
                                        onChange={(e) => setEditNickname(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t('team.role')}</label>
                                    <Select value={editRole} onValueChange={setEditRole}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={t('team.role')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="member">{t('team.roles.member')}</SelectItem>
                                            <SelectItem value="admin">{t('team.roles.admin')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" onClick={() => setIsEditOpen(false)}>{t('common.cancel')}</Button>
                                <Button onClick={handleUpdate} disabled={loading}>
                                    {loading ? t('common.loading') : t('common.save')}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                <ConfirmDialog
                    isOpen={!!deleteId}
                    onClose={() => setDeleteId(null)}
                    onConfirm={handleDelete}
                    title={t('team.remove_dialog_title')}
                    description={t('team.remove_dialog_desc')}
                    confirmText={t('common.delete')}
                    cancelText={t('common.cancel')}
                    variant="destructive"
                />
            </div>
        </div>
    );
}
