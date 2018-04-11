import ProtoBuf from 'protobufjs'
import path from 'path'

const fpath = path.join(__dirname, 'protocol.proto')
const builder = ProtoBuf.loadProtoFile(fpath)

export default builder.build('srpc')
