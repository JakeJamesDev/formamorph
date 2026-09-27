import { comfyRejection } from './imageGen/comfyui';

/** DEV: a ComfyUI rejection for a checkpoint the server doesn't have, built by the real parser. */
export function devErrorDetailsSample(): Error {
  return comfyRejection(400, {
    error: {
      type: 'prompt_outputs_failed_validation',
      message: 'Prompt outputs failed validation',
      details: '',
      extra_info: {},
    },
    node_errors: {
      '4': {
        errors: [{
          type: 'value_not_in_list',
          message: 'Value not in list',
          details: "ckpt_name: 'sdxl.safetensors' not in (list of length 23)",
          extra_info: { input_name: 'ckpt_name', input_config: null, received_value: 'sdxl.safetensors' },
        }],
        dependent_outputs: ['9'],
        class_type: 'CheckpointLoaderSimple',
      },
    },
  });
}
