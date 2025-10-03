import Task from '../models/Task';
import Comment from '../models/Comment';
import { Request, Response } from 'express';

/**
 * Get all comments for a specific task with authorization check
 */
export const getTaskComments = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const { taskId } = req.params;

        const task = await Task.findById(taskId);
        
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        if (task.isPrivate) {
            if (task.createdBy.toString() !== user.id) {
                res.status(403).json({ message: 'Not authorized to view comments on this task' });
                return;
            }
        } else {
            const isAssignedToUser = task.assignedTo?.toString() === user.id;
            const isUnassigned = !task.assignedTo;
            
            if (user.role !== 'organisation' && !isAssignedToUser && !isUnassigned) {
                res.status(403).json({ message: 'Not authorized to view comments on this task' });
                return;
            }
        }

        const comments = await Comment.find({ taskId })
            .sort({ createdAt: 1 })
            .select('userId userName text createdAt');

        res.status(200).json(comments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching comments', error });
    }
};

/**
 * Create a new comment on a task with authorization check
 */
export const createComment = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const { taskId } = req.params;
        const { text } = req.body;

        if (!text || !text.trim()) {
            res.status(400).json({ message: 'Comment text is required' });
            return;
        }

        const task = await Task.findById(taskId);
        
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        if (task.isPrivate) {
            if (task.createdBy.toString() !== user.id) {
                res.status(403).json({ message: 'Only the task creator can comment on private tasks' });
                return;
            }
        } else {
            const isAssignedToUser = task.assignedTo?.toString() === user.id;
            if (user.role !== 'organisation' && !isAssignedToUser) {
                res.status(403).json({ message: 'Not authorized to comment on this task' });
                return;
            }
        }

        const newComment = new Comment({
            taskId,
            userId: user.id,
            userName: user.name,
            text: text.trim()
        });

        const savedComment = await newComment.save();
        res.status(201).json(savedComment);
    } catch (error: any) {
        res.status(400).json({ message: 'Error creating comment', error: error.message });
    }
};

/**
 * Update a comment (only by the comment author)
 */
export const updateComment = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const { commentId } = req.params;
        const { text } = req.body;

        if (!text || !text.trim()) {
            res.status(400).json({ message: 'Comment text is required' });
            return;
        }

        const comment = await Comment.findById(commentId);

        if (!comment) {
            res.status(404).json({ message: 'Comment not found' });
            return;
        }

        if (comment.userId.toString() !== user.id) {
            res.status(403).json({ message: 'Not authorized to edit this comment' });
            return;
        }

        comment.text = text.trim();
        const updatedComment = await comment.save();
        
        res.status(200).json(updatedComment);
    } catch (error) {
        res.status(500).json({ message: 'Error updating comment', error });
    }
};

/**
 * Delete a comment (by author or organisation)
 */
export const deleteComment = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const { commentId } = req.params;

        const comment = await Comment.findById(commentId);

        if (!comment) {
            res.status(404).json({ message: 'Comment not found' });
            return;
        }

        if (comment.userId.toString() !== user.id && user.role !== 'organisation') {
            res.status(403).json({ message: 'Not authorized to delete this comment' });
            return;
        }

        await Comment.findByIdAndDelete(commentId);
        res.status(200).json({ message: 'Comment deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting comment', error });
    }
};