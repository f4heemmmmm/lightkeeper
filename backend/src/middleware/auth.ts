import jwt from 'jsonwebtoken';
import User from '../models/User';
import { Request, Response, NextFunction } from 'express';

interface JwtPayload {
    id: string;
}

/**
 * Protect routes by verifying JWT token and attaching user to request
 */
export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            res.status(401).json({ 
                message: 'Access denied. Please login to continue.' 
            });
            return;
        }

        let decoded: JwtPayload;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
        } catch (error: any) {
            if (error.name === 'TokenExpiredError') {
                res.status(401).json({ 
                    message: 'Your session has expired. Please login again.' 
                });
                return;
            }
            
            if (error.name === 'JsonWebTokenError') {
                res.status(401).json({ 
                    message: 'Invalid authentication token. Please login again.' 
                });
                return;
            }

            res.status(401).json({ 
                message: 'Authentication failed. Please login again.' 
            });
            return;
        }

        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            res.status(401).json({ 
                message: 'User account no longer exists. Please register or contact support.' 
            });
            return;
        }

        (req as any).user = user;
        next();
    } catch (error) {
        console.error('Authentication middleware error:', error);
        res.status(500).json({ 
            message: 'An error occurred during authentication. Please try again later.' 
        });
    }
};

/**
 * Restrict access to organisation role only
 */
export const isOrganisation = (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user) {
        res.status(401).json({ 
            message: 'Authentication required. Please login to continue.' 
        });
        return;
    }

    if (user.role !== 'organisation') {
        res.status(403).json({ 
            message: 'Access denied. This action requires an organisation account.' 
        });
        return;
    }
    next();
};