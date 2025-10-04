import { Request, Response } from 'express';
import Task, { ITask } from '../models/Task';

/**
 * Get all tasks visible to the authenticated user based on their role
 */
export const getAllTasks = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        let tasks;

        if (user.role === 'organisation') {
            tasks = await Task.find({ isPrivate: false }).sort({ createdAt: -1 }).populate('assignedTo', 'name email');
        } else {
            tasks = await Task.find({
                $or: [
                    { assignedTo: user.id, isPrivate: false },
                    { createdBy: user.id, isPrivate: true }
                ]
            }).sort({ createdAt: -1 }).populate('assignedTo', 'name email');
        }

        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching tasks', error });
    }
};

/**
 * Get all unassigned non-private tasks for members to select from
 */
export const getUnassignedTasks = async (req: Request, res: Response): Promise<void> => {
    try {
        const tasks = await Task.find({ 
            assignedTo: null,
            isPrivate: false 
        }).sort({ createdAt: -1 });
        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching unassigned tasks', error });
    }
};

/**
 * Get a single task by ID with authorization check
 */
export const getTaskById = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const task = await Task.findById(req.params.id).populate('assignedTo', 'name email');
        
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        if (task.isPrivate && task.createdBy.toString() !== user.id) {
            res.status(403).json({ message: 'Not authorized to view this task' });
            return;
        }

        res.status(200).json(task);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching task', error });
    }
};

/**
 * Create a new task with role-based privacy restrictions
 */
export const createTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const { title, description, priority, dueDate, isPrivate } = req.body;

        if (!isPrivate && user.role !== 'organisation') {
            res.status(403).json({ message: 'Members can only create private tasks' });
            return;
        }

        const newTask = new Task({
            title,
            description,
            priority,
            dueDate,
            assignedTo: null,
            isPrivate: isPrivate || false,
            createdBy: user.id,
            status: 'pending'
        });

        const savedTask = await newTask.save();
        const populatedTask = await Task.findById(savedTask._id).populate('assignedTo', 'name email');
        res.status(201).json(populatedTask);
    } catch (error) {
        res.status(400).json({ message: 'Error creating task', error });
    }
};

/**
 * Update task details with authorization checks
 */
export const updateTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const { title, description, priority, dueDate, status } = req.body;

        const task = await Task.findById(req.params.id);
        
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        if (task.isPrivate && task.createdBy.toString() !== user.id) {
            res.status(403).json({ message: 'Not authorized to update this task' });
            return;
        }

        if (!task.isPrivate) {
            if (user.role !== 'organisation' && task.assignedTo?.toString() !== user.id) {
                res.status(403).json({ message: 'Not authorized to update this task' });
                return;
            }
        }

        const updateData: any = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (priority !== undefined) updateData.priority = priority;
        if (dueDate !== undefined) updateData.dueDate = dueDate;
        if (status !== undefined) updateData.status = status;

        const updatedTask = await Task.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('assignedTo', 'name email');

        res.status(200).json(updatedTask);
    } catch (error) {
        res.status(400).json({ message: 'Error updating task', error });
    }
};

/**
 * Assign task to a member (self-assignment for members, any member for organisation)
 */
export const assignTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const { userId } = req.body;

        const task = await Task.findById(req.params.id);
        
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        if (task.isPrivate) {
            res.status(400).json({ message: 'Private tasks cannot be assigned to other users' });
            return;
        }

        if (task.assignedTo && user.role !== 'organisation') {
            res.status(403).json({ message: 'This task is already assigned' });
            return;
        }

        let assignToUserId;
        if (user.role === 'organisation' && userId) {
            assignToUserId = userId;
        } else {
            assignToUserId = user.id;
        }

        const updatedTask = await Task.findByIdAndUpdate(
            req.params.id,
            { assignedTo: assignToUserId },
            { new: true, runValidators: true }
        ).populate('assignedTo', 'name email');

        res.status(200).json(updatedTask);
    } catch (error) {
        res.status(400).json({ message: 'Error assigning task', error });
    }
};

/**
 * Remove task assignment
 */
export const unassignTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const task = await Task.findById(req.params.id);
        
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        if (task.isPrivate) {
            res.status(400).json({ message: 'Cannot unassign private tasks' });
            return;
        }

        if (user.role !== 'organisation' && task.assignedTo?.toString() !== user.id) {
            res.status(403).json({ message: 'Not authorized to unassign this task' });
            return;
        }

        const updatedTask = await Task.findByIdAndUpdate(
            req.params.id,
            { assignedTo: null },
            { new: true, runValidators: true }
        );

        res.status(200).json(updatedTask);
    } catch (error) {
        res.status(400).json({ message: 'Error unassigning task', error });
    }
};

/**
 * Delete task with role-based authorization
 */
export const deleteTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        const task = await Task.findById(req.params.id);

        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        if (task.isPrivate) {
            if (task.createdBy.toString() !== user.id) {
                res.status(403).json({ message: 'Not authorized to delete this task' });
                return;
            }
        } else {
            if (user.role !== 'organisation') {
                res.status(403).json({ message: 'Only organisation can delete non-private tasks' });
                return;
            }
        }

        await Task.findByIdAndDelete(req.params.id);
        res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting task', error });
    }
};
