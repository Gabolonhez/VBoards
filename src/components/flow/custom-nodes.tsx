import React, { memo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from 'reactflow';

const OmniHandle = ({ position, isConnectable, className }: { position: Position, isConnectable: boolean, className?: string }) => (
    <>
        <Handle type="target" position={position} id={`${position}-target`} isConnectable={isConnectable} className={className} />
        <Handle type="source" position={position} id={`${position}-source`} isConnectable={isConnectable} className={className} />
    </>
);

export const DiamondNode = memo(({ data, isConnectable, selected }: NodeProps) => {
    return (
        <>
            <NodeResizer minWidth={80} minHeight={80} isVisible={selected} color="#ff0071" />
            <div className="relative w-full h-full flex items-center justify-center min-w-[80px] min-h-[80px]">
                <div className="absolute inset-0 border-2 border-primary bg-background rotate-45 z-0" />
                <div className="relative z-10 p-2 text-center text-xs break-words rotate-0 max-w-[70%]">
                    {data.label}
                </div>
                <OmniHandle position={Position.Top} isConnectable={isConnectable} className="-mt-3.5" />
                <OmniHandle position={Position.Right} isConnectable={isConnectable} className="-mr-3.5" />
                <OmniHandle position={Position.Bottom} isConnectable={isConnectable} className="-mb-3.5" />
                <OmniHandle position={Position.Left} isConnectable={isConnectable} className="-ml-3.5" />
            </div>
        </>
    );
});

export const TextNode = memo(({ data, selected }: NodeProps) => {
    return (
        <div className="p-2 min-w-[100px] text-center">
            {selected && <div className="absolute inset-0 border border-dashed border-primary/50 -m-1 rounded pointer-events-none" />}
            {data.label}
        </div>
    );
});

export const CircleNode = memo(({ data, isConnectable, selected }: NodeProps) => {
    return (
        <>
            <NodeResizer minWidth={60} minHeight={60} isVisible={selected} color="#ff0071" />
            <div className="w-full h-full rounded-full border-2 border-primary bg-background flex items-center justify-center text-xs p-1 text-center min-w-[60px] min-h-[60px]">
                {data.label}
                <OmniHandle position={Position.Top} isConnectable={isConnectable} />
                <OmniHandle position={Position.Right} isConnectable={isConnectable} />
                <OmniHandle position={Position.Bottom} isConnectable={isConnectable} />
                <OmniHandle position={Position.Left} isConnectable={isConnectable} />
            </div>
        </>
    );
});

export const RectangleNode = memo(({ data, isConnectable, selected }: NodeProps) => {
    return (
        <>
            <NodeResizer minWidth={100} minHeight={50} isVisible={selected} color="#ff0071" />
            <div className="w-full h-full border-2 border-primary bg-background flex items-center justify-center text-xs p-2 rounded-md min-w-[100px] min-h-[50px]">
                {data.label}
                <OmniHandle position={Position.Top} isConnectable={isConnectable} />
                <OmniHandle position={Position.Right} isConnectable={isConnectable} />
                <OmniHandle position={Position.Bottom} isConnectable={isConnectable} />
                <OmniHandle position={Position.Left} isConnectable={isConnectable} />
            </div>
        </>
    );
});

DiamondNode.displayName = "DiamondNode";
TextNode.displayName = "TextNode";
CircleNode.displayName = "CircleNode";
RectangleNode.displayName = "RectangleNode";
