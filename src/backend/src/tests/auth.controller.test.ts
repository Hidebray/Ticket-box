import { Request, Response } from 'express';
import { register, login } from '../controllers/auth.controller';
import { prismaMock } from './setup';
import bcrypt from 'bcrypt';

describe('Auth Controller - register', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let statusMock: jest.Mock;
    let jsonMock: jest.Mock;

    beforeEach(() => {
        jsonMock = jest.fn();
        statusMock = jest.fn().mockReturnValue({ json: jsonMock });
        mockReq = {
            body: {}
        };
        mockRes = {
            status: statusMock,
            json: jsonMock
        } as unknown as Response;
        jest.clearAllMocks();
    });

    it('should block non-AUDIENCE roles', async () => {
        mockReq.body = { email: 'test@test.com', password: 'password', role: 'ORGANIZER' };
        
        await register(mockReq as Request, mockRes as Response);
        
        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({ message: 'Self-registration is only allowed for role AUDIENCE' });
    });

    it('should return 409 if email already exists', async () => {
        mockReq.body = { email: 'test@test.com', password: 'password', role: 'AUDIENCE' };
        
        prismaMock.users.findUnique.mockResolvedValueOnce({
            id: '1', email: 'test@test.com', password: 'hash', role: 'AUDIENCE', created_at: new Date()
        });
        
        await register(mockReq as Request, mockRes as Response);
        
        expect(statusMock).toHaveBeenCalledWith(409);
        expect(jsonMock).toHaveBeenCalledWith({ message: 'Email already exists' });
    });

    it('should successfully register a new user', async () => {
        mockReq.body = { email: 'new@test.com', password: 'password123', role: 'AUDIENCE' };
        
        prismaMock.users.findUnique.mockResolvedValueOnce(null);
        prismaMock.users.create.mockResolvedValueOnce({
            id: 'uuid-123', email: 'new@test.com', password: 'hashed-password', role: 'AUDIENCE', created_at: new Date()
        });
        
        jest.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve('hashed-password') as any);
        
        await register(mockReq as Request, mockRes as Response);
        
        expect(statusMock).toHaveBeenCalledWith(201);
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
            message: 'User created successfully'
        }));
    });

    it('should return 401 for wrong password', async () => {
        mockReq.body = { email: 'test@test.com', password: 'wrong' };
        prismaMock.users.findUnique.mockResolvedValueOnce({
            id: '1', email: 'test@test.com', password: 'hash', role: 'AUDIENCE', created_at: new Date()
        });
        jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false) as any);
        
        await login(mockReq as Request, mockRes as Response);
        expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should return valid JWT token on success', async () => {
        mockReq.body = { email: 'test@test.com', password: 'password' };
        prismaMock.users.findUnique.mockResolvedValueOnce({
            id: '1', email: 'test@test.com', password: 'hash', role: 'AUDIENCE', created_at: new Date()
        });
        jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true) as any);
        
        await login(mockReq as Request, mockRes as Response);
        expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ token: expect.any(String) }));
    });
});
