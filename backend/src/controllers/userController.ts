import User from '../models/User';
import { Request, Response } from 'express';

/**
 * Get all users with member role for task assignment
 */
export const getAllMembers = async (req: Request, res: Response): Promise<void> => {
    try {
        const members = await User.find({ role: 'member' })
            .select('name email')
            .sort({ name: 1 });
        
        res.status(200).json(members);
    } catch (error) {
        console.error('Get members error:', error);
        res.status(500).json({ 
            message: 'An error occurred while fetching members. Please try again later.' 
        });
    }
};