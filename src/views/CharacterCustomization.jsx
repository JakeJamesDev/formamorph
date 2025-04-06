import React, { useState } from 'react';
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import VRMViewer from './VRMViewer';

const CharacterCustomization = ({onCharacterCustomized }) => {
  const [bodyShape, setBodyShape] = useState({
    pear: 0,
    apple: 0,
    hourglass: 0
  });
  const [bellySize, setBellySize] = useState(0);
  const [breastsSize, setBreastsSize] = useState(0);
  const [bodyWeight, setBodyWeight] = useState(0);
  const [hairColor, setHairColor] = useState('#7d0909');
  const [eyeColor, setEyeColor] = useState('#86ff70');
  const [skinColor, setSkinColor] = useState('#fcdec7');
 
  const [hairTypes, setHairTypes] = useState({
    ponytail: {
      shapekey: 'Hair',
      canChangeLength: true
    },
    bobcut: {
      shapekey: 'Hair001',
      canChangeLength: false
    }
  });
  const [currentHairStyle, setCurrentHairStyle] = useState('ponytail');
  const [hairLength, setHairLength] = useState(0);

  const handleFinalize = () => {
    const characterData = {
      bodyShape,
      bellySize,
      breastsSize,
      bodyWeight,
      hairColor,
      eyeColor,
      skinColor,
      currentHairStyle,
      hairLength
    };
    onCharacterCustomized({...characterData, hairTypes:hairTypes});
  };

  const handleBodyShapeChange = (shape, value) => {
    setBodyShape(prev => ({ ...prev, [shape]: value[0] }));
  };

  const handleHairStyleChange = (value) => {
    setCurrentHairStyle(value);
    if (!hairTypes[value].canChangeLength) {
      setHairLength(0);
    }
  };

  const customizationProps = {
    bodyShape,
    bellySize,
    breastsSize,
    bodyWeight,
    hairColor,
    eyeColor,
    skinColor,
    currentHairStyle,
    hairLength
  };

  return (
    <div className="flex h-screen">
      <Card className="w-2/3 m-4 bg-secondary">
        <CardHeader>
          <CardTitle>Character Viewer</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-full">
          {/* Adjust the VRMViewer container */}
          <div className="w-full h-full" style={{ aspectRatio: '3/4' }}>
            <VRMViewer 
              bellySize={bellySize} 
              breastSize={breastsSize} 
              bodyWeight={bodyWeight} 
              hairColor={hairColor} 
              eyeColor={eyeColor} 
              skinColor={skinColor}
              hairTypes={hairTypes} 
              currentHairStyle={currentHairStyle} 
              hairLength={hairLength}
              bodyShape={bodyShape}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="w-1/3 m-4 overflow-y-auto">
        <CardHeader>
          <CardTitle>Character Customization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
        <Button onClick={handleFinalize} className="w-full mt-4">
            Finalize Character
          </Button>
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">Hair Style</h3>
            <Select onValueChange={handleHairStyleChange} value={currentHairStyle}>
              <SelectTrigger>
                <SelectValue placeholder="Select a hair style" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(hairTypes).map((style) => (
                  <SelectItem key={style} value={style}>
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hairTypes[currentHairStyle].canChangeLength && (
              <div className="space-y-2">
                <Label htmlFor="hair-length">Hair Length</Label>
                <Slider
                  id="hair-length"
                  min={0}
                  max={2}
                  step={0.1}
                  value={[hairLength]}
                  onValueChange={([newValue]) => setHairLength(newValue)}
                />
                <span className="text-sm text-muted-foreground">{hairLength.toFixed(1)}</span>
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Body Shape</h3>
            {Object.entries(bodyShape).map(([shape, value]) => (
              <div key={shape} className="space-y-2">
                <Label htmlFor={shape}>{shape.charAt(0).toUpperCase() + shape.slice(1)}</Label>
                <Slider
                  id={shape}
                  min={0}
                  max={2}
                  step={0.1}
                  value={[value]}
                  onValueChange={(newValue) => handleBodyShapeChange(shape, newValue)}
                />
                <span className="text-sm text-muted-foreground">{value.toFixed(1)}</span>
              </div>
            ))}
          </div>

      
          

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Initial Body Features</h3>
            {[
              //belly size isn't accessible in customization
              //{ label: 'Belly Size', value: bellySize, setValue: setBellySize },
              { label: 'Breasts Size', value: breastsSize, setValue: setBreastsSize },
              { label: 'Body Weight', value: bodyWeight, setValue: setBodyWeight },
            ].map(({ label, value, setValue }) => (
              <div key={label} className="space-y-2">
                <Label htmlFor={label.toLowerCase().replace(' ', '-')}>{label}</Label>
                <Slider
                  id={label.toLowerCase().replace(' ', '-')}
                  min={-0.3}
                  max={0.3}
                  step={0.05}
                  value={[value]}
                  onValueChange={([newValue]) => setValue(newValue)}
                />
                <span className="text-sm text-muted-foreground">{value.toFixed(1)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Colors</h3>
            {[
              { label: 'Hair Color', value: hairColor, setValue: setHairColor },
              { label: 'Eye Color', value: eyeColor, setValue: setEyeColor },
              { label: 'Skin Color', value: skinColor, setValue: setSkinColor },
            ].map(({ label, value, setValue }) => (
              <div key={label} className="flex items-center space-x-2">
                <Label htmlFor={label.toLowerCase().replace(' ', '-')}>{label}</Label>
                <Input
                  id={label.toLowerCase().replace(' ', '-')}
                  type="color"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-10 h-10 p-0 border-0"
                />
                <span className="text-sm text-muted-foreground">{value}</span>
              </div>
            ))}
          
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const defaultCharacterData = {
  bodyShape: {
    pear: 0,
    apple: 0,
    hourglass: 0
  },
  bellySize: 0,
  breastsSize: 0,
  bodyWeight: 0,
  hairColor: '#7d0909',
  eyeColor: '#86ff70',
  skinColor: '#fcdec7',
  currentHairStyle: 'ponytail',
  hairLength: 0,
  hairTypes: {
    ponytail: {
      shapekey: 'Hair',
      canChangeLength: true
    },
    bobcut: {
      shapekey: 'Hair001',
      canChangeLength: false
    }
  }
};

export default CharacterCustomization;
