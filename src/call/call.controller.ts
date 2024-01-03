import { Controller, Get } from '@nestjs/common';
import { Public } from 'src/common/decorators';

@Controller('call')
export class CallController {
    
    @Public()
    @Get()
    async demo(){
        return {message: 'Call controller'}
    }
}
